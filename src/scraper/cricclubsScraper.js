const { parseScore } = require('./parseScore');

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

class CricClubsScraper {
  constructor(options = {}) {
    this.browser = null;
    this.chromiumArgs = options.chromiumArgs || [];
    this.executablePath = options.executablePath || null;
    this.timeoutMs = options.timeoutMs || 30000;
    this.waitAfterLoadMs = options.waitAfterLoadMs || 3000;
    this.proxyUrl = options.proxyUrl || null;
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

  async scrape(matchUrl) {
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
      return parseScore(fullText);
    } finally {
      await context.close();
    }
  }
}

module.exports = {
  CricClubsScraper
};

