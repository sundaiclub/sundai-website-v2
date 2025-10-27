#!/bin/bash
set -euo pipefail

# Usage and validation
if [ "${1-}" = "" ]; then
  echo "Usage: ./scripts/restore_db.sh <path/to/backup.sql.gz>"
  echo "Available backups (newest first):"
  ls -1t .data/backups/*.gz 2>/dev/null || echo "No backups found in .data/backups"
  exit 1
fi

BACKUP_FILE="$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Ensure DB container is running
if ! docker compose ps postgres --status running -q >/dev/null; then
  echo "Postgres container is not running. Start it with: npm run db:up"
  exit 1
fi

# Uncompress to temp file
TEMP_FILE="${BACKUP_FILE%.gz}"
echo "Uncompressing backup..."
gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

# Restore into sundai_db database as postgres user
echo "Restoring database from: $TEMP_FILE"
docker compose exec -T postgres psql -U postgres -d sundai_db < "$TEMP_FILE"

# Clean up
echo "Cleaning up..."
rm -f "$TEMP_FILE"

echo "Restore completed!"