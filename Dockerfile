FROM node:20-slim AS deps

WORKDIR /app

# Install only production dependencies and strip npm cache.
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --fund=false && npm cache clean --force

FROM node:20-slim AS browser

# Install Chromium via Playwright into a fixed path so it can be copied to runtime stage.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npx playwright install chromium && rm -rf /root/.npm

FROM node:20-slim AS runtime

# Chromium runtime dependencies for Playwright.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=browser /ms-playwright /ms-playwright
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
