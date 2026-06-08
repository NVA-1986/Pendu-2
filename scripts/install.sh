#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:NVA-1986/Pendu-2.git}"
APP_DIR="${APP_DIR:-/opt/henker-spiel}"
PUBLIC_SERVICE="${PUBLIC_SERVICE:-henker-spiel}"
ADMIN_SERVICE="${ADMIN_SERVICE:-henker-spiel-admin}"
APP_USER="${APP_USER:-henker-spiel}"
BRANCH="${BRANCH:-V2}"
PUBLIC_PORT="${PUBLIC_PORT:-4173}"
ADMIN_PORT="${ADMIN_PORT:-4174}"
PUBLIC_HOST="${PUBLIC_HOST:-0.0.0.0}"
ADMIN_HOST="${ADMIN_HOST:-127.0.0.1}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Ce script doit être exécuté en root." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y git ca-certificates build-essential python3 make g++ nodejs npm openssl

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$APP_USER"
fi

mkdir -p "$(dirname "$APP_DIR")"

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
  git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
else
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm introuvable après installation. Vérifie la configuration APT de Node.js." >&2
  exit 1
fi

NPM_BIN="$(command -v npm)"

cd "$APP_DIR"
"$NPM_BIN" install --omit=dev

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

ADMIN_SECRET_FILE="/etc/henker-spiel-admin.env"
if [[ ! -f "$ADMIN_SECRET_FILE" ]]; then
  ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"
  cat >"$ADMIN_SECRET_FILE" <<EOF
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_SESSION_SECRET=$ADMIN_SESSION_SECRET
EOF
  chmod 600 "$ADMIN_SECRET_FILE"
else
  if grep -q '^ADMIN_PASSWORD=' "$ADMIN_SECRET_FILE"; then
    sed -i "s#^ADMIN_PASSWORD=.*#ADMIN_PASSWORD=$ADMIN_PASSWORD#" "$ADMIN_SECRET_FILE"
  else
    echo "ADMIN_PASSWORD=$ADMIN_PASSWORD" >> "$ADMIN_SECRET_FILE"
  fi
fi

cat >/etc/systemd/system/$PUBLIC_SERVICE.service <<EOF
[Unit]
Description=Pendu Schwiiz Public
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$PUBLIC_PORT
Environment=HOST=$PUBLIC_HOST
ExecStart=$NPM_BIN run start:public
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/$ADMIN_SERVICE.service <<EOF
[Unit]
Description=Pendu Schwiiz Admin
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=$ADMIN_PORT
Environment=HOST=$ADMIN_HOST
EnvironmentFile=$ADMIN_SECRET_FILE
ExecStart=$NPM_BIN run start:admin
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$PUBLIC_SERVICE" "$ADMIN_SERVICE"
systemctl restart "$PUBLIC_SERVICE" "$ADMIN_SERVICE"

echo "Installation terminée. Public: http://$PUBLIC_HOST:$PUBLIC_PORT | Admin: http://$ADMIN_HOST:$ADMIN_PORT"
