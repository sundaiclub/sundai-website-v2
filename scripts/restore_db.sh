#!/bin/bash

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: ./restore-db.sh <backup_file>"
    echo "Available backups:"
    ls -1 .data/backups/*.gz
    exit 1
fi

BACKUP_FILE=$1

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Create temporary uncompressed file
TEMP_FILE="${BACKUP_FILE%.gz}"
echo "Uncompressing backup..."
gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

# Restore database
echo "Restoring database from: $TEMP_FILE"
docker compose exec -T postgres psql -U postgres learn_anything < "$TEMP_FILE"

# Clean up
echo "Cleaning up..."
rm "$TEMP_FILE"

echo "Restore completed!" 