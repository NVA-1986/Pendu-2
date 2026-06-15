#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/henker-spiel}"
PUBLIC_SERVICE="${PUBLIC_SERVICE:-henker-spiel}"
ADMIN_SERVICE="${ADMIN_SERVICE:-henker-spiel-admin}"
BRANCH="${BRANCH:-main}"
WORDS_DATA_DIR="${WORDS_DATA_DIR:-/var/lib/henker-spiel}"
WORDS_DATA_FILE="${WORDS_DATA_FILE:-$WORDS_DATA_DIR/words.json}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Ce script doit être exécuté en root." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "Dépôt Git introuvable dans $APP_DIR" >&2
  exit 1
fi

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

mkdir -p "$WORDS_DATA_DIR"
BACKUP_FILE="$WORDS_DATA_FILE.preupdate"
cd "$APP_DIR"
if [[ -f "$WORDS_DATA_FILE" ]]; then
  cp "$WORDS_DATA_FILE" "$BACKUP_FILE" 2>/dev/null || true
elif [[ -f "$APP_DIR/backend/data/words.json" ]]; then
  cp "$APP_DIR/backend/data/words.json" "$BACKUP_FILE" 2>/dev/null || true
fi

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

if [[ -s "$BACKUP_FILE" ]]; then
  cp "$BACKUP_FILE" "$WORDS_DATA_FILE"
  rm -f "$BACKUP_FILE"
elif [[ ! -f "$WORDS_DATA_FILE" ]]; then
  echo "[]" > "$WORDS_DATA_FILE"
fi

ln -sfn "$WORDS_DATA_FILE" "$APP_DIR/backend/data/words.json"

npm install --omit=dev
systemctl restart "$PUBLIC_SERVICE" "$ADMIN_SERVICE"

echo "Mise à jour terminée et services redémarrés: $PUBLIC_SERVICE, $ADMIN_SERVICE"
