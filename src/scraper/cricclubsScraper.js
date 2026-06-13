const { parseScore } = require('./parseScore');

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

      await page.goto(matchUrl, {
        waitUntil: 'networkidle',
        timeout: this.timeoutMs
      });

      // Extra wait for Cloudflare JS challenge to complete
      await new Promise(r => setTimeout(r, this.waitAfterLoadMs));

      // If still on Cloudflare challenge, wait longer
      const bodyText = await page.evaluate(() => document.body.innerText);
      if (bodyText.includes('security verification') || bodyText.includes('Performing security')) {
        await new Promise(r => setTimeout(r, 8000));
      }

      const fullText = await page.evaluate(() => document.body.innerText);
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

