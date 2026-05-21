const config = require('./config');
const { CricClubsScraper } = require('./scraper/cricclubsScraper');
const { ScoreService } = require('./services/scoreService');
const { createApp } = require('./app');

async function main() {
  const scraper = new CricClubsScraper({
    chromiumArgs: config.chromiumArgs,
    timeoutMs: config.scrapeTimeoutMs,
    waitAfterLoadMs: config.waitAfterLoadMs,
    proxyUrl: config.proxyUrl
  });

  await scraper.start();

  const scoreService = new ScoreService({
    scraper,
    normalIntervalMs: config.normalIntervalMs,
    postOverIntervalMs: config.postOverIntervalMs,
    logosDir: config.logosDir
  });

  if (config.matchUrl) {
    await scoreService.start(config.matchUrl);
  }

  const app = createApp({
    scoreService,
    scraper,
    staticDir: config.staticDir,
    logosDir: config.logosDir
  });

  const server = app.listen(config.port, () => {
    console.log(`Cricket overlay server listening on port ${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down.`);
    scoreService.stop();
    await scraper.stop();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
