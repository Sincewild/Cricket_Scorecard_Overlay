const path = require('path');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const NORMAL_INTERVAL_MS = Number.parseInt(process.env.NORMAL_INTERVAL_MS || '20000', 10);
const POST_OVER_INTERVAL_MS = Number.parseInt(process.env.POST_OVER_INTERVAL_MS || '45000', 10);
const MATCH_URL = process.env.MATCH_URL || null;

const config = {
  port: Number.isFinite(PORT) ? PORT : 3000,
  normalIntervalMs: Number.isFinite(NORMAL_INTERVAL_MS) ? NORMAL_INTERVAL_MS : 20000,
  postOverIntervalMs: Number.isFinite(POST_OVER_INTERVAL_MS) ? POST_OVER_INTERVAL_MS : 45000,
  matchUrl: MATCH_URL,
  staticDir: path.join(__dirname, '..', 'public'),
  logosDir: path.join(__dirname, 'logos'),
  chromiumArgs: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ]
};

module.exports = config;
