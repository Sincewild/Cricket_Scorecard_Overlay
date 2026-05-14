# Cricket Live Overlay for YOLOBox Ultra

Self-hosted CricClubs score overlay service designed for deployment on platforms like Render.
The server scrapes live score text with Playwright and serves an HTML overlay plus a JSON API.

## Project Goals

- Broadcast-friendly scorebar for YOLOBox and browser sources.
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
        scraper/
                cricclubsScraper.js      # Playwright browser + scraping logic
                parseScore.js            # Heuristic parser for score text
        services/
                scoreService.js          # Polling scheduler + in-memory cache
        utils/
                validateMatchUrl.js      # Match URL validation and allowlist
public/
        overlay.html               # Overlay UI used by YOLOBox/browser
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
npm run install-browsers
```

3. Start server:

```bash
npm start
```

4. Set match URL:

```bash
curl "http://localhost:3000/set-match?url=https://www.cricclubs.com/USCL/ballbyball.do?matchId=782&clubId=2153"
```

5. Open overlay in browser:

```
http://localhost:3000/
```

## API Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Overlay UI |
| `/score` | GET | Current parsed score JSON |
| `/health` | GET | Service and scraper status |
| `/set-match?url=...` | GET | Set CricClubs match URL and start polling |

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP server port |
| `SCRAPE_INTERVAL_MS` | `30000` | Polling interval in milliseconds |
| `MATCH_URL` | unset | Optional auto-start match URL |

## Deployment on Render

Use these commands (already reflected in `render.yaml`):

- Build command: `npm install && npx playwright install chromium`
- Start command: `npm start`

After deployment:

1. Set match URL via `/set-match?url=...`
2. Add `https://YOUR-SERVICE.onrender.com/` as Web URL overlay in YOLOBox

## Security and Safety Notes

- `/set-match` only accepts `http`/`https` CricClubs URLs.
- `/set-match` is rate-limited to reduce abuse.
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
- Invalid URL error:
        - Ensure URL is from a CricClubs domain and properly encoded.

## Scripts

- `npm start` - start production server
- `npm run dev` - start server (same as start)
- `npm run install-browsers` - install Playwright Chromium
- `npm run check` - quick Node syntax check for entrypoint
