#!/bin/bash
set -e

# Load environment variables
source .env

# Setup
BACKUP_DIR=".data/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Use PostgreSQL 16 binaries
PG_DUMP="/opt/homebrew/opt/postgresql@16/bin/pg_dump"

# Backup
echo "Creating backup: ${BACKUP_FILE}"
"$PG_DUMP" "$DATABASE_URL" --no-owner --clean --if-exists > "${BACKUP_FILE}"

# Compress
echo "Compressing backup..."
gzip "${BACKUP_FILE}"
echo "Backup completed: ${BACKUP_FILE}.gz"

# Cleanup (keep last 5 backups)
echo "Cleaning up old backups..."
ls -t "${BACKUP_DIR}"/*.gz | tail -n +6 | xargs -r rm