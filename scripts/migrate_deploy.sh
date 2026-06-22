#!/bin/bash
set -euo pipefail

if [ "${VERCEL:-}" = "1" ] && [ "${VERCEL_ENV:-}" = "preview" ] && [ "${VERCEL_GIT_COMMIT_REF:-}" != "dev" ]; then
  echo "Skipping Prisma migrations for preview branch ${VERCEL_GIT_COMMIT_REF:-unknown}"
  exit 0
fi

# Prisma migrate deploy should use a direct database connection when available.
if [ -n "${DIRECT_URL:-}" ]; then
  export DATABASE_URL="$DIRECT_URL"
fi

npx prisma migrate deploy
