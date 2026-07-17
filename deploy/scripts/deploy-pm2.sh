#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/itcp-training"
WEB_ROOT="/var/www/itcp-training"
LOG_DIR="/var/log/itcp-training"
NGINX_AVAILABLE="/etc/nginx/sites-available/itcp-training"
NGINX_ENABLED="/etc/nginx/sites-enabled/itcp-training"

cd "${APP_DIR}"

if [[ ! -f .env ]]; then
  echo "Missing ${APP_DIR}/.env" >&2
  exit 1
fi

npm ci
npm run build

install -d -m 755 "${WEB_ROOT}" "${LOG_DIR}" "${APP_DIR}/server/uploads"
find "${WEB_ROOT}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
cp -a client/dist/. "${WEB_ROOT}/"

install -m 644 deploy/nginx/itcpeurope.nl.conf "${NGINX_AVAILABLE}"
ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

nginx -t
systemctl reload nginx

pm2 startOrReload deploy/pm2/ecosystem.config.cjs --update-env
pm2 save

curl --fail --silent --show-error --retry 12 --retry-delay 3 --retry-connrefused \
  http://127.0.0.1:4300/api/v1/health
printf '\nPM2 deployment health check passed.\n'
