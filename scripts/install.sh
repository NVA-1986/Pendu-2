#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:NVA-1986/Pendu-2.git}"
APP_DIR="${APP_DIR:-/opt/henker-spiel}"
SERVICE_NAME="${SERVICE_NAME:-henker-spiel}"
APP_USER="${APP_USER:-henker-spiel}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-4173}"
HOST="${HOST:-0.0.0.0}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Ce script doit être exécuté en root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git ca-certificates build-essential python3 make g++ nodejs npm

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$APP_USER"
fi

mkdir -p "$(dirname "$APP_DIR")"

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"
npm install --omit=dev

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

cat >/etc/systemd/system/$SERVICE_NAME.service <<EOF
[Unit]
Description=Pendu Schwiiz
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=HOST=$HOST
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "Installation terminée. Service: $SERVICE_NAME sur http://$HOST:$PORT"
