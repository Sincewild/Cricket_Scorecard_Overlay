const path = require('path');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const NORMAL_INTERVAL_MS = Number.parseInt(process.env.NORMAL_INTERVAL_MS || '20000', 10);
const POST_OVER_INTERVAL_MS = Number.parseInt(process.env.POST_OVER_INTERVAL_MS || '45000', 10);
const MATCH_URL = process.env.MATCH_URL || null;
const SCRAPE_TIMEOUT_MS = Number.parseInt(process.env.SCRAPE_TIMEOUT_MS || '60000', 10);
const WAIT_AFTER_LOAD_MS = Number.parseInt(process.env.WAIT_AFTER_LOAD_MS || '8000', 10);
const PROXY_URL = process.env.PROXY_URL || null;
const CHROMIUM_EXECUTABLE_PATH = process.env.CHROMIUM_EXECUTABLE_PATH || null;

const config = {
  port: Number.isFinite(PORT) ? PORT : 3000,
  normalIntervalMs: Number.isFinite(NORMAL_INTERVAL_MS) ? NORMAL_INTERVAL_MS : 20000,
  postOverIntervalMs: Number.isFinite(POST_OVER_INTERVAL_MS) ? POST_OVER_INTERVAL_MS : 45000,
  matchUrl: MATCH_URL,
  scrapeTimeoutMs: Number.isFinite(SCRAPE_TIMEOUT_MS) ? SCRAPE_TIMEOUT_MS : 60000,
  waitAfterLoadMs: Number.isFinite(WAIT_AFTER_LOAD_MS) ? WAIT_AFTER_LOAD_MS : 8000,
  proxyUrl: PROXY_URL,
  chromiumExecutablePath: CHROMIUM_EXECUTABLE_PATH,
  staticDir: path.join(__dirname, '..', 'public'),
  logosDir: path.join(__dirname, 'logos'),
  chromiumArgs: process.env.NODE_ENV === 'production' ? [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ] : []
};

module.exports = config;
