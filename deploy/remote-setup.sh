#!/usr/bin/env bash
set -euo pipefail

echo "==> ServerHub remote setup"

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin required."
  exit 1
fi

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env file"
  exit 1
fi

echo "==> Building and starting containers..."
docker compose --env-file .env up -d --build

echo "==> Done!"
docker compose ps
