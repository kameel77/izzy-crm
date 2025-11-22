#!/usr/bin/env sh
set -e

PORT="${PORT:-5555}"
SCHEMA_PATH="${SCHEMA_PATH:-/app/schema.prisma}"

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL env variable is required" >&2
  exit 1
fi

exec npx prisma studio --schema "$SCHEMA_PATH" --hostname 0.0.0.0 --port "$PORT"
