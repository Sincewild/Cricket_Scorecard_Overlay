const { parseScore } = require('./parseScore');

class CricClubsScraper {
  constructor(options = {}) {
    this.browser = null;
    this.chromiumArgs = options.chromiumArgs || [];
    this.timeoutMs = options.timeoutMs || 30000;
    this.waitAfterLoadMs = options.waitAfterLoadMs || 3000;
  }

  async start() {
    if (this.browser) {
      return;
    }

    const { chromium } = require('playwright');
    this.browser = await chromium.launch({
      headless: true,
      args: this.chromiumArgs
    });
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });

    try {
      const page = await context.newPage();

      await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,mp4,webm}', (route) => route.abort());
      await page.route('**/ads/**', (route) => route.abort());
      await page.route('**/analytics**', (route) => route.abort());
      await page.route('**/google-analytics**', (route) => route.abort());

      await page.goto(matchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeoutMs
      });

      await page.waitForTimeout(this.waitAfterLoadMs);

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
