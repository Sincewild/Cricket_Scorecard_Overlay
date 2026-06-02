FROM node:20-slim

# Chromium system dependencies for CloakBrowser/Playwright
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
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer cached unless package.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# Download Chromium binary (cached unless cloakbrowser version changes)
RUN npx cloakbrowser install

# Copy app source
COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "src/index.js"]
