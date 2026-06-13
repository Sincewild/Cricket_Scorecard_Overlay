# Cricket Live Overlay for YOLOBox Ultra

Self-hosted CricClubs score overlay service. Scrapes live score text with Playwright and serves HTML overlays plus a JSON API.

## Project Goals

- Broadcast-friendly scorebar for YOLOBox and browser sources.
- Multiple overlay variants with team logos.
- Duck animation when a batsman is dismissed for 0.
- Simple API endpoints for operations (`/set-match`, `/score`, `/health`).
- Safer-by-default deployment behavior:
  - URL validation for match source.
  - Basic hardening middleware (`helmet`, route rate limiting).
  - Graceful shutdown and modular server structure.

## Architecture

```
src/
  app.js                     # Express app, middleware, routes
  config.js                  # Environment-driven runtime settings
  index.js                   # Process entrypoint and lifecycle
  state.js                   # Initial score model
  animation/
    duck-alpha.webm          # Duck animation with alpha transparency (VP9/WebM)
    duck-sample1-2.mp4       # Source duck video
  logos/                     # Team logo image assets
  scraper/
    cricclubsScraper.js      # Playwright browser + scraping logic
    parseScore.js            # Heuristic parser for score text
  services/
    scoreService.js          # Polling scheduler + in-memory cache
  utils/
    teamLogoResolver.js      # Resolves team name to logo path
    validateMatchUrl.js      # Match URL validation and allowlist
public/
  overlay.html               # Default overlay (no logo)
  hrcc-logo-overlay.html     # HRCC team logo overlay variant
  jl-logo-overlay.html       # Jersey Lions logo overlay variant
  admin.html                 # Admin UI for setting match URL
```

## How Data Flows

```
CricClubs scoring app
  -> CricClubs website scorecard
  -> Playwright scraper (every 30s, configurable)
  -> In-memory cache
  -> /score JSON endpoint
  -> overlay.html polling UI
  -> YOLOBox Web URL source
```

## Requirements

- Node.js 18+
- npm
- Chromium runtime for Playwright

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Install Playwright browser:

```bash
npm run setup:browser
```

3. Start server:

```bash
npm start
```

4. Set match URL (two options):

```bash
# Full URL
curl "http://localhost:3000/set-match?url=https://www.cricclubs.com/USCL/ballbyball.do?matchId=782&clubId=2153"

# Shorthand with matchId + clubId
curl "http://localhost:3000/set-match?matchId=782&clubId=2153"
```

5. Open overlay in browser:

```
http://localhost:3000/             # default overlay
http://localhost:3000/overlay      # same as above
http://localhost:3000/admin        # admin UI to set match URL
```

## API Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Default overlay UI |
| `/overlay` | GET | Default overlay UI (alias) |
| `/hrcc-logo-overlay.html` | GET | HRCC logo overlay variant |
| `/jl-logo-overlay.html` | GET | Jersey Lions logo overlay variant |
| `/admin` | GET | Admin UI for managing match |
| `/score` | GET | Current parsed score JSON |
| `/health` | GET | Service and scraper status |
| `/set-match?url=...` | GET | Set CricClubs match URL and start polling |
| `/set-match?matchId=...&clubId=...` | GET | Shorthand to set match by IDs |
| `/unset-match` | GET | Clear current match and stop polling |
| `/debug-scrape` | GET | Raw scraped text (supports `?offset=&limit=`) |
| `/debug-batter` | GET | Raw text around the Batter header |
| `/logos/*` | GET | Serve team logo images from `src/logos/` |
| `/animation/*` | GET | Serve animation files from `src/animation/` |

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port |
| `SCRAPE_INTERVAL_MS` | `30000` | Polling interval in milliseconds |
| `MATCH_URL` | unset | Optional auto-start match URL |

## Duck Animation

When a batsman is dismissed for 0 runs, the overlay shows a duck animation.

- Source: `src/animation/duck-sample1-2.mp4` (white background, 1280x720)
- Served: `src/animation/duck-alpha.webm` — re-encoded VP9/WebM with alpha transparency via `colorkey` white removal
- CSS: `mix-blend-mode: screen` removes the black background in overlays that can't use alpha

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start production server |
| `npm run dev` | Start server (same as start) |
| `npm run setup:browser` | Install Playwright Chromium |
| `npm run check` | Quick Node syntax check for entrypoint |
| `npm run pm2:start` | Start with PM2 (production) |
| `npm run pm2:stop` | Stop PM2 process |
| `npm run pm2:restart` | Restart PM2 process |
| `npm run pm2:logs` | View PM2 logs |
| `npm run pm2:status` | Check PM2 process status |

## Deployment

### Render

Use these commands (already reflected in `render.yaml`):

- Build command: `npm install && npx playwright install chromium`
- Start command: `npm start`

After deployment:

1. Set match URL via `/set-match?url=...`
2. Add `https://YOUR-SERVICE.onrender.com/` as Web URL overlay in YOLOBox

### VPS with Docker

```bash
docker-compose up -d
```

Nginx and Traefik configs are in `nginx/` and `traefik/` respectively. Setup script at `scripts/setup-vps.sh`.

### GitHub Actions Deploy from VPS (Recommended)

If your VPS provider blocks GitHub-hosted runner IPs, deploy with a self-hosted GitHub Actions runner installed on the VPS.

1. In GitHub, go to repository settings and create a Linux self-hosted runner.
2. On the VPS, install and start the runner service:

```bash
cd /opt
sudo mkdir -p actions-runner && sudo chown "$USER":"$USER" actions-runner
cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/latest/download/actions-runner-linux-x64.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

# Use the registration URL/token shown in GitHub UI
./config.sh --url https://github.com/sincewild/Cricket_Scorecard_Overlay --token YOUR_TOKEN --labels self-hosted,linux,x64
sudo ./svc.sh install
sudo ./svc.sh start
```

3. Ensure Docker/Compose is available for the runner user and that the repo exists on the VPS in the deployment directory.
4. Push to `main` (or run the workflow manually) and verify the `Deploy on VPS (Self-Hosted Runner)` job picks your VPS runner.

This avoids SSH ingress from random GitHub runner IPs entirely.

### VPS with PM2

```bash
npm run pm2:start
```

## Security and Safety Notes

- `/set-match` only accepts `http`/`https` CricClubs URLs.
- `/set-match` is rate-limited to 20 requests/minute.
- `helmet` headers are enabled with CSP relaxed for overlay compatibility.
- Express `x-powered-by` header is disabled.

## Operational Notes

- Score cache is in-memory only. Restarting process clears the current match state.
- Playwright scraping is heuristic and may need parser updates if CricClubs layout/text changes.
- Free Render instances may sleep; first request after idle can be slow.

## Troubleshooting

- Overlay stuck on loading:
  - Check `/health`.
  - Confirm the process is up and `browserRunning` is true.
- Score not updating:
  - Re-call `/set-match` with a valid CricClubs match URL.
  - Confirm `lastUpdated` changes in `/score`.
  - If you see `page.goto timeout` or a security verification error, CricClubs likely presented an anti-bot challenge.
  - Set `PROXY_URL` in `.env` to a clean static/residential proxy and redeploy.
  - Increase `SCRAPE_TIMEOUT_MS` to `90000` if your VPS network is slow.
- Invalid URL error:
  - Ensure URL is from a CricClubs domain and properly encoded.
  - Or use the `?matchId=&clubId=` shorthand to avoid encoding issues.
- Duck animation not playing:
  - Confirm `src/animation/duck-alpha.webm` exists.
  - Check browser console for video load errors.
