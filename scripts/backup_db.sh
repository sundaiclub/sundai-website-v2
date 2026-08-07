#!/bin/bash
set -euo pipefail

# Load environment variables
source .env

# Setup
BACKUP_DIR=".data/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

PG_DUMP="${PG_DUMP:-pg_dump}"
if ! command -v "$PG_DUMP" >/dev/null 2>&1; then
  echo "pg_dump is required but was not found in PATH."
  exit 1
fi

# Prefer a direct database connection for backup operations.
DB_BACKUP_URL="${DIRECT_URL:-$DATABASE_URL}"
if [[ "$DB_BACKUP_URL" == *"?"* ]]; then
  DB_URL_BASE="${DB_BACKUP_URL%%\?*}"
  DB_URL_QUERY="${DB_BACKUP_URL#*\?}"
  FILTERED_QUERY="$(printf '%s' "$DB_URL_QUERY" | tr '&' '\n' | awk '$0 !~ /^schema=/' | paste -sd '&' -)"

  if [ -n "$FILTERED_QUERY" ]; then
    DB_BACKUP_URL="${DB_URL_BASE}?${FILTERED_QUERY}"
  else
    DB_BACKUP_URL="${DB_URL_BASE}"
  fi
fi

# Backup
echo "Creating backup: ${BACKUP_FILE}"
"$PG_DUMP" "$DB_BACKUP_URL" --no-owner --clean --if-exists > "${BACKUP_FILE}"

# Compress
echo "Compressing backup..."
gzip "${BACKUP_FILE}"
echo "Backup completed: ${BACKUP_FILE}.gz"

# Cleanup (keep last 5 backups)
echo "Cleaning up old backups..."
ls -t "${BACKUP_DIR}"/*.gz | tail -n +6 | xargs -r rm
