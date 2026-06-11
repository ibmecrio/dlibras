#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# DLibras — one-shot deploy: build images, rsync repo, restart compose.
# Target: 187.77.253.138  (override via env: SSH_HOST / SSH_USER / REMOTE_DIR)
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
SSH_HOST="${SSH_HOST:-187.77.253.138}"
SSH_USER="${SSH_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/dlibras}"
ENV_FILE="${ENV_FILE:-docker/.env.production}"
BUILD_LOCALLY="${BUILD_LOCALLY:-0}"
SSH_OPTS="${SSH_OPTS:--o ConnectTimeout=15 -o ServerAliveInterval=30}"

# ── Pretty output ───────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
RESET=$'\033[0m'

log()  { printf "%s[deploy]%s %s\n" "$BLUE"   "$RESET" "$*"; }
ok()   { printf "%s[ ok ]%s %s\n"  "$GREEN"  "$RESET" "$*"; }
warn() { printf "%s[warn]%s %s\n"  "$YELLOW" "$RESET" "$*"; }
die()  { printf "%s[fail]%s %s\n"  "$RED"    "$RESET" "$*" >&2; exit 1; }

# ── Pre-flight ──────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

[[ -f docker-compose.yml ]]            || die "docker-compose.yml not found at $ROOT"
[[ -f docker/Dockerfile.web ]]         || die "docker/Dockerfile.web missing"
[[ -f docker/Dockerfile.api ]]         || die "docker/Dockerfile.api missing"

if [[ ! -f "$ENV_FILE" ]]; then
    warn "$ENV_FILE not found — copy docker/.env.production.example and fill the secrets."
    read -r -p "Continue without local env file? [y/N] " ans
    [[ "${ans,,}" == "y" ]] || die "Aborted."
fi

command -v rsync  >/dev/null 2>&1 || die "rsync is required on this machine."
command -v ssh    >/dev/null 2>&1 || die "ssh is required on this machine."
command -v docker >/dev/null 2>&1 || warn "docker not found locally — skipping local build."

# ── Confirm target ──────────────────────────────────────────────────
log "Target  : ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}"
log "Domain  : https://dlibras.app  (IP ${SSH_HOST})"
log "Env file: ${ENV_FILE}"
read -r -p "Proceed with deploy? [y/N] " ans
[[ "${ans,,}" == "y" ]] || die "Aborted."

# ── 1) Local sanity build (optional, fast feedback) ────────────────
if [[ "$BUILD_LOCALLY" == "1" ]] && command -v docker >/dev/null 2>&1; then
    log "Building images locally for a sanity check…"
    docker compose --env-file "$ENV_FILE" build
    ok "Local build succeeded."
else
    log "Skipping local docker build (set BUILD_LOCALLY=1 to enable)."
fi

# ── 2) Rsync project to server ──────────────────────────────────────
log "Syncing project to ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}…"

ssh $SSH_OPTS "${SSH_USER}@${SSH_HOST}" "mkdir -p '${REMOTE_DIR}'"

# Exclude bulky / local-only stuff. Keep the Libras backend (models/, code).
rsync -az --delete --human-readable \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='.expo/' \
    --exclude='dist/' \
    --exclude='web-build/' \
    --exclude='.venv/' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    --exclude='.DS_Store' \
    --exclude='/ios/' \
    --exclude='/android/' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.*.local' \
    --exclude='vision-agent/.venv/' \
    --exclude='Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition/.venv/' \
    --exclude='Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition/__pycache__/' \
    -e "ssh $SSH_OPTS" \
    "$ROOT/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

ok "Project synced."

# ── 3) Send env file separately (it's gitignored, so rsync skipped it) ─
if [[ -f "$ENV_FILE" ]]; then
    log "Uploading ${ENV_FILE}…"
    rsync -az -e "ssh $SSH_OPTS" \
        "$ROOT/$ENV_FILE" \
        "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/docker/.env.production"
    ssh $SSH_OPTS "${SSH_USER}@${SSH_HOST}" "chmod 600 '${REMOTE_DIR}/docker/.env.production'"
    ok "Env file uploaded."
fi

# ── 4) Build + restart on the server ────────────────────────────────
log "Building images and (re)starting services on the server…"
ssh $SSH_OPTS "${SSH_USER}@${SSH_HOST}" "set -euo pipefail
    cd '${REMOTE_DIR}'
    docker compose --env-file docker/.env.production pull --ignore-pull-failures || true
    docker compose --env-file docker/.env.production build
    docker compose --env-file docker/.env.production up -d --remove-orphans
    docker compose --env-file docker/.env.production ps
"
ok "Stack is up."

# ── 5) Smoke test ───────────────────────────────────────────────────
log "Smoke-testing public endpoint…"
if curl -sk --max-time 10 -o /dev/null -w "%{http_code}" "https://${SSH_HOST}/" | grep -qE "^(200|301|302|308)$"; then
    ok "https://${SSH_HOST}/ responded."
else
    warn "Public smoke test inconclusive. Check logs:"
    warn "  ssh ${SSH_USER}@${SSH_HOST} 'cd ${REMOTE_DIR} && docker compose logs --tail=200'"
fi

cat <<EOF

${GREEN}Deploy finished.${RESET}

Live URLs (after DNS + TLS are set up):
  ${BLUE}https://dlibras.app${RESET}
  ${BLUE}https://www.dlibras.app${RESET}
  ${BLUE}https://${SSH_HOST}${RESET}        (raw IP — cert won't match)

Useful follow-ups:
  ssh ${SSH_USER}@${SSH_HOST} 'cd ${REMOTE_DIR} && docker compose logs -f api'
  ssh ${SSH_USER}@${SSH_HOST} 'cd ${REMOTE_DIR} && docker compose logs -f nginx'
  ssh ${SSH_USER}@${SSH_HOST} 'cd ${REMOTE_DIR} && docker compose ps'

First-time TLS issuance (only once, see DEPLOY-DOCKER.md):
  ssh ${SSH_USER}@${SSH_HOST} 'cd ${REMOTE_DIR} && docker compose run --rm certbot \\
      certonly --webroot -w /var/www/certbot \\
      -d dlibras.app -d www.dlibras.app \\
      --email admin@dlibras.app --agree-tos --no-eff-email'

EOF
