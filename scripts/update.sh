#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/henker-spiel}"
SERVICE_NAME="${SERVICE_NAME:-henker-spiel}"
BRANCH="${BRANCH:-main}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Ce script doit être exécuté en root." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Dépôt Git introuvable dans $APP_DIR" >&2
  exit 1
fi

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
npm install --omit=dev
systemctl restart "$SERVICE_NAME"

echo "Mise à jour terminée et service redémarré: $SERVICE_NAME"
