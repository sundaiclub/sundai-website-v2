#!/bin/bash
set -euo pipefail

if [ "${VERCEL:-}" = "1" ] && [ "${VERCEL_ENV:-}" = "preview" ]; then
  case "${VERCEL_GIT_COMMIT_REF:-}" in
    dev|v3)
      ;;
    *)
      echo "Skipping Prisma migrations for preview branch ${VERCEL_GIT_COMMIT_REF:-unknown}"
      exit 0
      ;;
  esac
fi

# Prisma migrate deploy should use a direct database connection when available.
if [ -n "${DIRECT_URL:-}" ]; then
  export DATABASE_URL="$DIRECT_URL"
fi

npx prisma migrate deploy
