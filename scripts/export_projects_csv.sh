#!/bin/bash
set -euo pipefail

OUTPUT_PATH="${1:-.data/exports/projects_export_$(date +%Y%m%d_%H%M%S).csv}"
OUTPUT_PATH="$(realpath -m "$OUTPUT_PATH")"
QUERY_PATH="$(realpath -m "$(dirname "$0")/sql/export_projects_without_user_emails.sql")"

mkdir -p "$(dirname "$OUTPUT_PATH")"

if [ -z "${DATABASE_URL:-}" ] && [ -z "${DIRECT_URL:-}" ] && [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ] && [ -z "${DIRECT_URL:-}" ]; then
  echo "DATABASE_URL or DIRECT_URL is not set. Add one to .env or export it in your shell."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but was not found in PATH."
  exit 1
fi

# Prefer a direct database connection for export operations.
PSQL_DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}"
if [[ "$PSQL_DATABASE_URL" == *"?"* ]]; then
  DB_URL_BASE="${PSQL_DATABASE_URL%%\?*}"
  DB_URL_QUERY="${PSQL_DATABASE_URL#*\?}"
  FILTERED_QUERY="$(printf '%s' "$DB_URL_QUERY" | tr '&' '\n' | awk '$0 !~ /^schema=/' | paste -sd '&' -)"

  if [ -n "$FILTERED_QUERY" ]; then
    PSQL_DATABASE_URL="${DB_URL_BASE}?${FILTERED_QUERY}"
  else
    PSQL_DATABASE_URL="${DB_URL_BASE}"
  fi
fi

echo "Exporting project data to $OUTPUT_PATH"
psql "$PSQL_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -q \
  -f "$QUERY_PATH" > "$OUTPUT_PATH"

echo "Done: $OUTPUT_PATH"
