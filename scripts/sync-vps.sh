#!/usr/bin/env bash
# Sync DLibras backend infra → VPS produção.
#
# Uso:
#   ./scripts/sync-vps.sh           — sync api_server.py + rebuild + restart
#   ./scripts/sync-vps.sh --full    — sync TODOS arquivos do server/ + rebuild full
#   ./scripts/sync-vps.sh --logs    — só ver os logs do container
#   ./scripts/sync-vps.sh --status  — status + health
#
# Requer: sshpass, env vars VPS_HOST, VPS_PORT, VPS_USER, VPS_PASS (ou edite os defaults)

set -euo pipefail

VPS_HOST="${VPS_HOST:-187.77.253.138}"
VPS_PORT="${VPS_PORT:-2222}"
VPS_USER="${VPS_USER:-root}"
VPS_PASS="${VPS_PASS:-Olivina@2026}"
REMOTE_DIR="${REMOTE_DIR:-/opt/dlibras}"

VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.config/dlibras/ssh/dlibras_vps}"

# Prefere SSH key se existir; fallback pra sshpass com senha
if [ -f "$VPS_SSH_KEY" ]; then
  SSH="ssh -i $VPS_SSH_KEY -p $VPS_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o IdentitiesOnly=yes $VPS_USER@$VPS_HOST"
  SCP="scp -i $VPS_SSH_KEY -P $VPS_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
else
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "❌ sshpass não instalado. macOS: brew install sshpass"
    exit 1
  fi
  SSHPASS_CMD="SSHPASS='$VPS_PASS' sshpass -e"
  SSH="$SSHPASS_CMD ssh -p $VPS_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $VPS_USER@$VPS_HOST"
  SCP="$SSHPASS_CMD scp -P $VPS_PORT -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
fi

cmd_status() {
  eval "$SSH 'cd $REMOTE_DIR && docker compose ps && echo --- && curl -s http://localhost:8801/health'"
}

cmd_logs() {
  eval "$SSH 'cd $REMOTE_DIR && docker compose logs -f --tail=50 api'"
}

cmd_quick() {
  echo "📤 Enviando api_server.py..."
  eval "$SCP server/api_server.py $VPS_USER@$VPS_HOST:$REMOTE_DIR/libras-vision/"
  echo "🔨 Rebuild + restart..."
  eval "$SSH 'cd $REMOTE_DIR && docker compose build api && docker compose up -d 2>&1 | tail -3'"
  echo "🩺 Health check..."
  sleep 8
  eval "$SSH 'curl -s http://localhost:8801/health'"
  echo ""
  echo "✅ Done."
}

cmd_full() {
  echo "📤 Sync server/ completo..."
  eval "$SCP -r server/Dockerfile.api server/docker-compose.yml server/api_server.py server/setup.sh $VPS_USER@$VPS_HOST:$REMOTE_DIR/"
  eval "$SCP server/api_server.py $VPS_USER@$VPS_HOST:$REMOTE_DIR/libras-vision/"
  echo "🔨 Build no-cache + restart..."
  eval "$SSH 'cd $REMOTE_DIR && docker compose build --no-cache api 2>&1 | tail -5 && docker compose up -d --force-recreate 2>&1 | tail -3'"
  echo "🩺 Health check (esperando 15s)..."
  sleep 15
  eval "$SSH 'curl -s http://localhost:8801/health'"
  echo ""
  echo "✅ Done."
}

case "${1:-quick}" in
  --status)  cmd_status ;;
  --logs)    cmd_logs ;;
  --full)    cmd_full ;;
  --quick|*) cmd_quick ;;
esac
