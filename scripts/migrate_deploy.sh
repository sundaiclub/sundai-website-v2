#!/bin/bash
set -euo pipefail

# Prisma migrate deploy should use a direct database connection when available.
if [ -n "${DIRECT_URL:-}" ]; then
  export DATABASE_URL="$DIRECT_URL"
fi

npx prisma migrate deploy
