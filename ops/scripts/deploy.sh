#!/usr/bin/env bash
set -euo pipefail

# Placeholder deployment script for staging VPS
# Requirements:
#   - SSH access configured with key
#   - Docker & docker-compose installed on remote host

if [[ $# -lt 1 ]]; then
  echo "Usage: ./deploy.sh user@host"
  exit 1
fi

REMOTE="$1"

echo "Deploying to ${REMOTE}..."

ssh "${REMOTE}" "mkdir -p ~/apps/izzy-crm"

rsync -az \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env*' \
  ./ "${REMOTE}:~/apps/izzy-crm"

ssh "${REMOTE}" <<'EOF'
  cd ~/apps/izzy-crm
  docker compose pull || true
  docker compose build
  docker compose up -d
EOF

echo "Deployment completed."
