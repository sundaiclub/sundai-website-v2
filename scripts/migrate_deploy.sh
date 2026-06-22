#!/bin/bash
set -euo pipefail

if [ "${VERCEL:-}" = "1" ] && [ "${VERCEL_ENV:-}" = "preview" ]; then
  branch="${VERCEL_GIT_COMMIT_REF:-unknown}"

  if [ "$branch" != "dev" ] && [ "$branch" != "v3" ]; then
    echo "Skipping Prisma migrations for preview branch $branch"
    exit 0
  fi
fi

# Prisma migrate deploy should use a direct database connection when available.
if [ -n "${DIRECT_URL:-}" ]; then
  export DATABASE_URL="$DIRECT_URL"
fi

npx prisma migrate deploy
