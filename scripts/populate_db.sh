#!/bin/bash
set -euo pipefail

# Start postgres if not running
if ! docker compose ps postgres --status running -q >/dev/null; then
  echo "Starting Postgres via docker compose..."
  docker compose up -d postgres
fi

# Ensure prisma client is generated
echo "Generating Prisma client..."
npx prisma generate

# Apply latest migrations to local dev DB (non-interactive)
echo "Applying migrations..."
npx prisma migrate deploy

# Seed database with sample data
echo "Seeding database..."
npm run seed

echo "Database populated successfully."


