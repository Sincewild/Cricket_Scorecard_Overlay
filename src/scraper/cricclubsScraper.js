const { parseScore, parseInningsScorecard } = require('./parseScore');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSecurityChallengePage(text) {
  const body = String(text || '').toLowerCase();
  return (
    body.includes('cloudflare') ||
    body.includes('checking your browser') ||
    body.includes('performing security') ||
    body.includes('security verification') ||
    body.includes('attention required')
  );
}

function isRetryableScrapeError(error) {
  const message = String(error && error.message ? error.message : '').toLowerCase();
  return (
    message.includes('security challenge') ||
    message.includes('timeout') ||
    message.includes('net::err_') ||
    message.includes('navigation')
  );
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

class CricClubsScraper {
  constructor(options = {}) {
    this.browser = null;
    this.chromiumArgs = options.chromiumArgs || [];
    this.executablePath = options.executablePath || null;
    this.timeoutMs = options.timeoutMs || 30000;
    this.waitAfterLoadMs = options.waitAfterLoadMs || 3000;
    this.proxyUrl = options.proxyUrl || null;
    this.challengeRetries = Number.isInteger(options.challengeRetries) ? options.challengeRetries : 2;
    this.challengeRetryDelayMs = options.challengeRetryDelayMs || 5000;
  }

  async start() {
    if (this.browser) {
      return;
    }

    const { chromium } = require('playwright-core');
    const launchOptions = {
      headless: true,
      args: [
        ...this.chromiumArgs,
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-infobars',
        '--window-size=1280,800',
      ],
      ...(this.executablePath ? { executablePath: this.executablePath } : {})
    };
    if (this.proxyUrl) {
      launchOptions.proxy = { server: this.proxyUrl };
    }
    this.browser = await chromium.launch(launchOptions);
  }

  async stop() {
    if (!this.browser) {
      return;
    }

    await this.browser.close();
    this.browser = null;
  }

  isRunning() {
    return Boolean(this.browser);
  }

  async gotoWithFallback(page, url) {
    const attempts = [
      { waitUntil: 'domcontentloaded', timeout: Math.min(this.timeoutMs, 30000) },
      { waitUntil: 'load', timeout: this.timeoutMs },
      { waitUntil: 'commit', timeout: this.timeoutMs }
    ];

    let lastError;
    for (const attempt of attempts) {
      try {
        await page.goto(url, attempt);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  async scrapeOnce(matchUrl) {
    if (!this.browser) {
      throw new Error('Browser is not initialized');
    }

    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      }
    });

    try {
      const page = await context.newPage();

      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,mp4,webm}', (route) => route.abort());
      await page.route('**/ads/**', (route) => route.abort());
      await page.route('**/analytics**', (route) => route.abort());
      await page.route('**/google-analytics**', (route) => route.abort());

      await this.gotoWithFallback(page, matchUrl);

      await page.waitForSelector('body', {
        timeout: Math.min(this.timeoutMs, 10000)
      }).catch(() => {});

      // Extra wait for Cloudflare JS challenge to complete
      await sleep(this.waitAfterLoadMs);

      // If still on Cloudflare challenge, wait longer
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (isSecurityChallengePage(bodyText)) {
        await sleep(8000);
      }

      const fullText = await page.evaluate(() => document.body.innerText);

      if (isSecurityChallengePage(fullText)) {
        throw new Error('CricClubs blocked the scraper with a security challenge. Set PROXY_URL to a clean residential/static proxy and retry /set-match.');
      }

      this.lastRawText = fullText;
      const parsed = parseScore(fullText);
      parsed.scorecard = await this.extractFullScorecard(page, parsed.team1, parsed.team2);
      const photos = await this.extractBatterPhotos(page, parsed.bat1, parsed.bat2);

      if (!photos.bat1Photo || !photos.bat2Photo) {
        const profileLinks = await this.extractBatterProfileLinks(page, parsed.bat1, parsed.bat2);

        if (!photos.bat1Photo && profileLinks.bat1ProfileUrl) {
          photos.bat1Photo = await this.extractProfilePhotoFromUrl(context, profileLinks.bat1ProfileUrl);
        }
        if (!photos.bat2Photo && profileLinks.bat2ProfileUrl) {
          photos.bat2Photo = await this.extractProfilePhotoFromUrl(context, profileLinks.bat2ProfileUrl);
        }
      }

      parsed.bat1Photo = photos.bat1Photo;
      parsed.bat2Photo = photos.bat2Photo;
      return parsed;
    } finally {
      await context.close();
    }
  }

  // Switches to the "Full Scorecard" tab and reads the batting/bowling card for
  // each team, mapping innings1 -> team1 (batted first) and innings2 -> team2.
  async extractFullScorecard(page, team1, team2) {
    try {
      const loaded = await page.evaluate(() => {
        if (typeof loadView === 'function') {
          loadView('fullScorecard');
          return true;
        }
        return false;
      });
      if (!loaded) return {};

      await sleep(2500);

      const scorecard = {};
      for (const teamName of [team1, team2]) {
        const clicked = await page.evaluate((name) => {
          const anchors = Array.from(document.querySelectorAll('a'));
          const target = anchors.find((a) => (a.textContent || '').trim() === name);
          if (target) {
            target.click();
            return true;
          }
          return false;
        }, teamName);
        if (clicked) await sleep(1200);

        const text = await page.evaluate(() => document.body.innerText);
        const innings = parseInningsScorecard(text);
        if (!innings) continue;

        const key = innings.battingTeam === team1 ? 'innings1' : 'innings2';
        const bowlingTeam = innings.battingTeam === team1 ? team2 : team1;
        scorecard[key] = {
          battingTeam: innings.battingTeam,
          batting: innings.batting,
          bowlingTeam,
          bowling: innings.bowling
        };
      }
      return scorecard;
    } catch (_) {
      return {};
    }
  }

  async extractBatterPhotos(page, bat1, bat2) {
    if (!bat1 && !bat2) {
      return { bat1Photo: null, bat2Photo: null };
    }

    const result = await page.evaluate(({ bat1, bat2 }) => {
      function normalize(value) {
        return String(value || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
      }

      function makeAbsoluteUrl(value) {
        if (!value) return null;
        try {
          return new URL(value, window.location.href).href;
        } catch (_) {
          return null;
        }
      }

      function scoreCandidate(candidate, fullName, lastName) {
        const src = String(candidate.src || '').toLowerCase();
        const joined = `${candidate.alt} ${candidate.title} ${candidate.aria} ${candidate.parent}`.toLowerCase();

        if (!src || src.startsWith('data:')) return -1;
        if (src.includes('logo') || src.includes('sponsor') || src.includes('icon') || src.includes('ad')) return -1;

        let score = 0;
        if (src.includes('player') || src.includes('profile') || src.includes('avatar')) score += 4;
        if (joined.includes(fullName)) score += 10;
        if (lastName && joined.includes(lastName)) score += 5;

        const parentNormalized = normalize(candidate.parent);
        const fullNormalized = normalize(fullName);
        const lastNormalized = normalize(lastName);

        if (fullNormalized && parentNormalized.includes(fullNormalized)) score += 8;
        if (lastNormalized && parentNormalized.includes(lastNormalized)) score += 4;

        if (candidate.width >= 32 && candidate.height >= 32 && candidate.width <= 300 && candidate.height <= 300) {
          score += 2;
        }

        return score;
      }

      const candidates = Array.from(document.querySelectorAll('img[src]')).map((img) => {
        const src = img.getAttribute('src') || '';
        const parent = img.closest('tr, li, div, td, th, section, article');
        return {
          src: makeAbsoluteUrl(src),
          alt: img.getAttribute('alt') || '',
          title: img.getAttribute('title') || '',
          aria: img.getAttribute('aria-label') || '',
          parent: parent ? String(parent.innerText || '').slice(0, 250) : '',
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0
        };
      });

      function findPhotoFor(name) {
        if (!name) return null;
        const trimmed = String(name).trim();
        if (!trimmed) return null;

        const parts = trimmed.split(/\s+/);
        const lastName = parts.length > 1 ? parts[parts.length - 1] : trimmed;

        let best = null;
        let bestScore = 0;
        for (const candidate of candidates) {
          const score = scoreCandidate(candidate, trimmed.toLowerCase(), lastName.toLowerCase());
          if (score > bestScore) {
            bestScore = score;
            best = candidate.src;
          }
        }

        return bestScore >= 8 ? best : null;
      }

      return {
        bat1Photo: findPhotoFor(bat1),
        bat2Photo: findPhotoFor(bat2)
      };
    }, { bat1, bat2 });

    return {
      bat1Photo: result && result.bat1Photo ? result.bat1Photo : null,
      bat2Photo: result && result.bat2Photo ? result.bat2Photo : null
    };
  }

  async extractBatterProfileLinks(page, bat1, bat2) {
    if (!bat1 && !bat2) {
      return { bat1ProfileUrl: null, bat2ProfileUrl: null };
    }

    const result = await page.evaluate(({ bat1, bat2 }) => {
      function normalize(value) {
        return String(value || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
      }

      function absoluteUrl(value) {
        if (!value) return null;
        try {
          return new URL(value, window.location.href).href;
        } catch (_) {
          return null;
        }
      }

      function findProfileUrlFor(name) {
        const normalizedTarget = normalize(name);
        if (!normalizedTarget) return null;

        // Prefer explicit player profile links that match the batter row/text.
        const directLinks = Array.from(document.querySelectorAll('a[href*="viewPlayer.do"]'));
        let bestDirect = null;
        let bestDirectScore = 0;

        for (const link of directLinks) {
          const href = link.getAttribute('href') || '';
          const text = (link.innerText || link.textContent || '').trim().toLowerCase();
          const rowText = (link.closest('tr, li, div, td')?.innerText || '').toLowerCase();
          const hrefLower = href.toLowerCase();
          const abs = absoluteUrl(href);
          if (!abs) continue;

          let score = 0;
          if (hrefLower.includes('viewplayer.do')) score += 8;
          if (normalize(text).includes(normalizedTarget)) score += 10;
          if (normalize(rowText).includes(normalizedTarget)) score += 7;
          if (/playerid=\d+/i.test(href)) score += 3;

          if (score > bestDirectScore) {
            bestDirectScore = score;
            bestDirect = abs;
          }
        }

        if (bestDirectScore >= 12) {
          return bestDirect;
        }

        const anchors = Array.from(document.querySelectorAll('a[href]'));
        let best = null;
        let bestScore = 0;

        for (const a of anchors) {
          const href = a.getAttribute('href') || '';
          const text = (a.innerText || a.textContent || '').trim();
          const rowText = (a.closest('tr, li, div, td')?.innerText || '').slice(0, 200);
          const blob = `${text} ${rowText}`.toLowerCase();
          const hrefLower = href.toLowerCase();
          const abs = absoluteUrl(href);
          if (!abs) continue;

          let score = 0;
          if (hrefLower.includes('player') || hrefLower.includes('profile') || hrefLower.includes('member')) score += 4;
          if (normalize(blob).includes(normalizedTarget)) score += 8;
          if (hrefLower.includes('id=')) score += 2;

          if (score > bestScore) {
            bestScore = score;
            best = abs;
          }
        }

        return bestScore >= 8 ? best : null;
      }

      function firstDistinctPlayerLinks() {
        const links = Array.from(document.querySelectorAll('a[href*="viewPlayer.do"][href*="playerId="]'))
          .map((a) => absoluteUrl(a.getAttribute('href')))
          .filter(Boolean);

        const unique = [];
        const seen = new Set();
        for (const url of links) {
          const m = url.match(/playerId=(\d+)/i);
          const key = m ? m[1] : url;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(url);
          }
          if (unique.length >= 4) break;
        }
        return unique;
      }

      let bat1ProfileUrl = findProfileUrlFor(bat1);
      let bat2ProfileUrl = findProfileUrlFor(bat2);

      if (!bat1ProfileUrl || !bat2ProfileUrl) {
        const fallback = firstDistinctPlayerLinks();
        if (!bat1ProfileUrl) bat1ProfileUrl = fallback[0] || null;
        if (!bat2ProfileUrl) bat2ProfileUrl = fallback[1] || null;
      }

      return {
        bat1ProfileUrl,
        bat2ProfileUrl
      };
    }, { bat1, bat2 });

    return {
      bat1ProfileUrl: result?.bat1ProfileUrl || null,
      bat2ProfileUrl: result?.bat2ProfileUrl || null
    };
  }

  async extractProfilePhotoFromUrl(context, profileUrl) {
    if (!profileUrl) return null;

    let profilePage;
    try {
      profilePage = await context.newPage();
      await profilePage.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: Math.min(this.timeoutMs, 30000)
      });

      await profilePage.waitForSelector('body', {
        timeout: Math.min(this.timeoutMs, 10000)
      }).catch(() => {});

      const photoUrl = await profilePage.evaluate(() => {
        function absolute(value) {
          if (!value) return null;
          try {
            return new URL(value, window.location.href).href;
          } catch (_) {
            return null;
          }
        }

        function isGenericLogo(url) {
          const lower = String(url || '').toLowerCase();
          return (
            lower.includes('/logos/') ||
            lower.includes('clublogo') ||
            lower.includes('league_logo') ||
            lower.includes('default')
          );
        }

        const imgs = Array.from(document.querySelectorAll('img[src]'));
        let best = null;
        let bestScore = 0;

        for (const img of imgs) {
          const src = img.getAttribute('src') || '';
          const abs = absolute(src);
          if (!abs) continue;
          if (isGenericLogo(abs)) continue;

          const srcLower = src.toLowerCase();
          if (srcLower.includes('logo') || srcLower.includes('sponsor') || srcLower.includes('icon')) continue;

          const alt = (img.getAttribute('alt') || '').toLowerCase();
          const cls = (img.getAttribute('class') || '').toLowerCase();
          const id = (img.getAttribute('id') || '').toLowerCase();
          const w = img.naturalWidth || img.width || 0;
          const h = img.naturalHeight || img.height || 0;

          let score = 0;
          if (srcLower.includes('player') || srcLower.includes('profile') || srcLower.includes('avatar')) score += 8;
          if (alt.includes('player') || alt.includes('profile')) score += 4;
          if (cls.includes('player') || cls.includes('profile') || id.includes('player') || id.includes('profile')) score += 4;
          if (w >= 48 && h >= 48 && w <= 500 && h <= 500) score += 3;

          if (score > bestScore) {
            bestScore = score;
            best = abs;
          }
        }

        if (bestScore > 0) return best;

        const metaOg = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        const ogAbs = absolute(metaOg);
        if (ogAbs && !isGenericLogo(ogAbs)) return ogAbs;

        const metaTw = document.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
        const twAbs = absolute(metaTw);
        if (twAbs && !isGenericLogo(twAbs)) return twAbs;

        return null;
      });

      return photoUrl || null;
    } catch (_) {
      return null;
    } finally {
      if (profilePage) {
        await profilePage.close().catch(() => {});
      }
    }
  }

  async scrape(matchUrl) {
    const totalAttempts = Math.max(1, this.challengeRetries + 1);
    let lastError;

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      try {
        return await this.scrapeOnce(matchUrl);
      } catch (error) {
        lastError = error;
        if (!isRetryableScrapeError(error) || attempt === totalAttempts) {
          break;
        }

        const delayMs = this.challengeRetryDelayMs * attempt;
        await sleep(delayMs);
      }
    }

    throw lastError;
  }
}

module.exports = {
  CricClubsScraper
};

