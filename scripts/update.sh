#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/henker-spiel}"
PUBLIC_SERVICE="${PUBLIC_SERVICE:-henker-spiel}"
ADMIN_SERVICE="${ADMIN_SERVICE:-henker-spiel-admin}"
BRANCH="${BRANCH:-V2}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Ce script doit être exécuté en root." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Dépôt Git introuvable dans $APP_DIR" >&2
  exit 1
fi

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
npm install --omit=dev
systemctl restart "$PUBLIC_SERVICE" "$ADMIN_SERVICE"

echo "Mise à jour terminée et services redémarrés: $PUBLIC_SERVICE, $ADMIN_SERVICE"
