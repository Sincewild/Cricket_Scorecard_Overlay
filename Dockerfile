FROM node:20-slim AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --fund=false && npm cache clean --force

FROM node:20-slim AS runtime

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Install playwright's exact matching Chromium + all system deps it needs.
# This must run after node_modules are present so the playwright CLI is available.
RUN node node_modules/.bin/playwright install --with-deps chromium \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
