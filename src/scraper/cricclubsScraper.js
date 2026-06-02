const { parseScore } = require('./parseScore');

class CricClubsScraper {
  constructor(options = {}) {
    this.browser = null;
    this.chromiumArgs = options.chromiumArgs || [];
    this.timeoutMs = options.timeoutMs || 30000;
    this.waitAfterLoadMs = options.waitAfterLoadMs || 3000;
    this.proxyUrl = options.proxyUrl || null;
  }

  async start() {
    if (this.browser) {
      return;
    }

    const { launch } = await import('cloakbrowser');
    const launchOptions = {
      headless: true,
      args: this.chromiumArgs
    };
    if (this.proxyUrl) {
      launchOptions.proxy = this.proxyUrl;
    }
    this.browser = await launch(launchOptions);
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
      viewport: { width: 1280, height: 800 }
    });

    try {
      const page = await context.newPage();

      await page.route('**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,mp4,webm}', (route) => route.abort());
      await page.route('**/ads/**', (route) => route.abort());
      await page.route('**/analytics**', (route) => route.abort());
      await page.route('**/google-analytics**', (route) => route.abort());

      await page.goto(matchUrl, {
        waitUntil: 'networkidle',
        timeout: this.timeoutMs
      });

      await new Promise(r => setTimeout(r, this.waitAfterLoadMs));

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

