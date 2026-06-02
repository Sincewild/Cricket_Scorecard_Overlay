FROM node:20-slim AS deps

WORKDIR /app

# Install only production dependencies and strip npm cache.
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --fund=false && npm cache clean --force

FROM node:20-slim AS runtime

# Install Chromium from apt — no network download during build, all deps pulled automatically.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Tell Playwright not to download its own browser; use the system Chromium instead.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
