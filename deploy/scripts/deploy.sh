#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_SEED=false

if [[ "${1:-}" == "--seed" ]]; then
  RUN_SEED=true
fi

for file in .env.stack .env.mongo .env.api; do
  if [[ ! -f "${DEPLOY_DIR}/${file}" ]]; then
    printf 'Missing %s/%s\n' "${DEPLOY_DIR}" "${file}" >&2
    exit 1
  fi
done

if [[ "${RUN_SEED}" == "true" && ! -f "${DEPLOY_DIR}/.env.seed" ]]; then
  printf 'Missing %s/.env.seed required for --seed\n' "${DEPLOY_DIR}" >&2
  exit 1
fi

COMPOSE=(
  docker compose
  --env-file "${DEPLOY_DIR}/.env.stack"
  -f "${DEPLOY_DIR}/docker-compose.production.yml"
)

"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build --pull
"${COMPOSE[@]}" up -d mongo api web

if [[ "${RUN_SEED}" == "true" ]]; then
  "${COMPOSE[@]}" --profile tools run --rm seed
fi

"${COMPOSE[@]}" ps

APP_HTTP_PORT="$(grep -E '^APP_HTTP_PORT=' "${DEPLOY_DIR}/.env.stack" | tail -1 | cut -d= -f2-)"
APP_HTTP_PORT="${APP_HTTP_PORT:-8088}"

node -e "fetch('http://127.0.0.1:${APP_HTTP_PORT}/api/v1/health').then(async r=>{console.log(await r.text());if(!r.ok)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})"
