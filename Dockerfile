FROM node:20-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --fund=false && npm cache clean --force

FROM node:20-slim AS runtime

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Install Chromium system deps (Debian Bookworm package names)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Download playwright's exact matching Chromium binary (148.x for playwright-core 1.60)
RUN node node_modules/.bin/playwright install chromium

COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
