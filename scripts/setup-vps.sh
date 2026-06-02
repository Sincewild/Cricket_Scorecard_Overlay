#!/bin/bash
set -e

echo "=== Cricket Overlay VPS Setup ==="

# --- Docker ---
if ! command -v docker &>/dev/null; then
  echo "[1/4] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "      Docker installed. Re-login for group changes to take effect."
else
  echo "[1/4] Docker already installed: $(docker -v)"
fi

# --- Docker Compose plugin ---
if ! docker compose version &>/dev/null 2>&1; then
  echo "[2/4] Installing Docker Compose plugin..."
  sudo apt-get update -y
  sudo apt-get install -y docker-compose-plugin
else
  echo "[2/4] Docker Compose already installed: $(docker compose version --short)"
fi

# --- Shared Traefik network (created once, used by all projects) ---
if ! docker network inspect traefik-public &>/dev/null; then
  echo "[3/4] Creating shared traefik-public network..."
  docker network create traefik-public
else
  echo "[3/4] traefik-public network already exists."
fi

# --- .env file ---
APP_DIR="/var/www/cricket-overlay"
if [ ! -f "$APP_DIR/.env" ]; then
  echo "[4/4] Creating .env from .env.example — EDIT IT before starting!"
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
else
  echo "[4/4] .env already exists, skipping."
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Start Traefik (one-time, shared by all projects):"
echo "     cd $APP_DIR/traefik && docker compose up -d"
echo ""
echo "  2. Edit .env:"
echo "     nano $APP_DIR/.env"
echo ""
echo "  3. Start the app:"
echo "     cd $APP_DIR && docker compose up -d"
echo ""
echo "  To migrate to a new VPS later:"
echo "     Run this script again on the new machine, then copy .env and start."
