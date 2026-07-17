#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${DEPLOY_DIR}/backups}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

mkdir -p "${TARGET_DIR}"

COMPOSE=(
  docker compose
  --env-file "${DEPLOY_DIR}/.env.stack"
  -f "${DEPLOY_DIR}/docker-compose.production.yml"
)

"${COMPOSE[@]}" exec -T mongo sh -lc \
  'mongodump --archive --gzip --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' \
  > "${TARGET_DIR}/mongo.archive.gz"

"${COMPOSE[@]}" exec -T api tar -C /app/server/uploads -czf - . \
  > "${TARGET_DIR}/uploads.tar.gz"

sha256sum "${TARGET_DIR}/mongo.archive.gz" "${TARGET_DIR}/uploads.tar.gz" \
  > "${TARGET_DIR}/SHA256SUMS"

printf 'Backup created: %s\n' "${TARGET_DIR}"
