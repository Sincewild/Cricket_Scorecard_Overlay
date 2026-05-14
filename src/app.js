const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { validateMatchUrl } = require('./utils/validateMatchUrl');

function createApp(options) {
  const app = express();
  const scoreService = options.scoreService;
  const staticDir = options.staticDir;
  const scraper = options.scraper;

  app.disable('x-powered-by');

  app.use(cors({
    origin: '*',
    methods: ['GET']
  }));

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  app.use(express.json({ limit: '16kb' }));

  const setMatchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use(express.static(staticDir));
  if (options.logosDir) {
    app.use('/logos', express.static(options.logosDir));
  }

  app.get('/score', (req, res) => {
    res.json(scoreService.getScore());
  });

  app.get('/set-match', setMatchLimiter, async (req, res) => {
    let rawUrl = req.query.url;

    // Accept matchId + clubId shorthand
    if (!rawUrl && req.query.matchId && req.query.clubId) {
      const matchId = String(req.query.matchId).replace(/\D/g, '');
      const clubId  = String(req.query.clubId).replace(/\D/g, '');
      if (!matchId || !clubId) {
        return res.status(400).json({ success: false, error: 'matchId and clubId must be numeric' });
      }
      rawUrl = `https://cricclubs.com/viewScorecard.do?matchId=${matchId}&clubId=${clubId}`;
    }

    const validation = validateMatchUrl(rawUrl);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.reason });
    }

    try {
      await scoreService.start(validation.url);
      return res.json({ success: true, message: 'Scraping started', url: validation.url });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/health', (req, res) => {
    const score = scoreService.getScore();
    res.json({
      status: 'ok',
      lastUpdated: score.lastUpdated,
      matchUrl: score.matchUrl,
      browserRunning: scraper.isRunning(),
      scraping: scoreService.isScraping(),
      uptimeSeconds: Math.floor(process.uptime())
    });
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(staticDir, 'overlay.html'));
  });

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(staticDir, 'admin.html'));
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

module.exports = {
  createApp
};
