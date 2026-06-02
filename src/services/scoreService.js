const { createInitialScoreState } = require('../state');
const { createTeamLogoResolver } = require('../utils/teamLogoResolver');

class ScoreService {
  constructor(options) {
    this.scraper = options.scraper;
    this.normalIntervalMs = options.normalIntervalMs || 20000;
    this.postOverIntervalMs = options.postOverIntervalMs || 45000;
    this.currentIntervalMs = this.normalIntervalMs;
    this.logoResolver = createTeamLogoResolver({ logosDir: options.logosDir });
    this.scoreCache = createInitialScoreState();
    this.scrapeTimer = null;
    this.prevThisOverLength = 0;  // Track previous over's ball count
    this.postOverTimeoutId = null;  // Track timeout for reverting to normal interval
  }

  getScore() {
    return this.scoreCache;
  }

  isScraping() {
    return Boolean(this.scrapeTimer);
  }

  updateInterval(newIntervalMs, durationMs = null) {
    if (newIntervalMs === this.currentIntervalMs) return;

    this.currentIntervalMs = newIntervalMs;

    // Clear existing timer and post-over timeout
    if (this.scrapeTimer) {
      clearInterval(this.scrapeTimer);
      this.scrapeTimer = null;
    }
    if (this.postOverTimeoutId) {
      clearTimeout(this.postOverTimeoutId);
      this.postOverTimeoutId = null;
    }

    // Restart with new interval
    const matchUrl = this.scoreCache.matchUrl;
    if (matchUrl) {
      this.scrapeTimer = setInterval(() => {
        this.scrapeOnce(matchUrl).catch((error) => {
          this.scoreCache.error = error.message;
          this.scoreCache.lastUpdated = new Date().toISOString();
        });
      }, this.currentIntervalMs);
    }

    // If duration specified, revert to normal after that time
    if (durationMs) {
      this.postOverTimeoutId = setTimeout(() => {
        if (this.currentIntervalMs !== this.normalIntervalMs) {
          this.updateInterval(this.normalIntervalMs);
        }
      }, durationMs);
    }
  }

  async start(matchUrl) {
    this.scoreCache.matchUrl = matchUrl;

    if (this.scrapeTimer) {
      clearInterval(this.scrapeTimer);
      this.scrapeTimer = null;
    }

    await this.scrapeOnce(matchUrl);

    this.currentIntervalMs = this.normalIntervalMs;
    this.scrapeTimer = setInterval(() => {
      this.scrapeOnce(matchUrl).catch((error) => {
        this.scoreCache.error = error.message;
        this.scoreCache.lastUpdated = new Date().toISOString();
      });
    }, this.currentIntervalMs);
  }

  async scrapeOnce(matchUrl) {
    if (!matchUrl) {
      this.scoreCache.error = 'No match URL set. Use /set-match?url=YOUR_CRICCLUBS_URL';
      this.scoreCache.lastUpdated = new Date().toISOString();
      return;
    }

    const parsed = await this.scraper.scrape(matchUrl);
    const team1Logo = this.logoResolver.resolveTeamLogoPath(parsed.team1);
    const team2Logo = this.logoResolver.resolveTeamLogoPath(parsed.team2);

    // Detect over completion: thisOver goes from 6 balls to 0-1 (new over starts)
    const currentThisOverLength = (parsed.thisOver && Array.isArray(parsed.thisOver)) 
      ? parsed.thisOver.length 
      : 0;
    
    if (this.prevThisOverLength === 6 && currentThisOverLength <= 1) {
      // Over just completed! Increase refresh interval for a period
      this.updateInterval(this.postOverIntervalMs, 8000);  // Pause for 8 seconds then revert
    }
    this.prevThisOverLength = currentThisOverLength;

    // Preserve previous batter data ONLY during true transient states (both batters missing)
    // If new batters are found, use them even if bat2 is null (wicket scenario)
    const preservedBatData = {};
    if (!parsed.bat1 && !parsed.bat2) {
      // Both missing = transient state, preserve both
      if (this.scoreCache.bat1) {
        preservedBatData.bat1 = this.scoreCache.bat1;
        preservedBatData.bat1r = this.scoreCache.bat1r;
        preservedBatData.bat1b = this.scoreCache.bat1b;
      }
      if (this.scoreCache.bat2) {
        preservedBatData.bat2 = this.scoreCache.bat2;
        preservedBatData.bat2r = this.scoreCache.bat2r;
        preservedBatData.bat2b = this.scoreCache.bat2b;
      }
    }
    // If bat1 is found, don't preserve bat2 (let null mean the batter is out)

    this.scoreCache = {
      ...this.scoreCache,
      ...parsed,
      ...preservedBatData,
      team1Logo,
      team2Logo,
      error: null,
      lastUpdated: new Date().toISOString(),
      matchUrl
    };
  }

  stop() {
    if (this.scrapeTimer) {
      clearInterval(this.scrapeTimer);
      this.scrapeTimer = null;
    }
    if (this.postOverTimeoutId) {
      clearTimeout(this.postOverTimeoutId);
      this.postOverTimeoutId = null;
    }
  }

  reset() {
    this.stop();
    this.scoreCache = createInitialScoreState();
    this.prevThisOverLength = 0;
    this.currentIntervalMs = this.normalIntervalMs;
  }
}

module.exports = {
  ScoreService
};
