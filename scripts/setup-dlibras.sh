#!/usr/bin/env bash
# DLibras one-shot setup.
# Installs JS deps, the Libras recognition Python deps, and scaffolds .env files.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIBRAS_DIR="$REPO_ROOT/Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition"
AGENT_DIR="$REPO_ROOT/vision-agent"

GREEN="\033[1;32m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
RESET="\033[0m"

info()  { printf "${GREEN}▸${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}!${RESET} %s\n" "$1"; }
error() { printf "${RED}✗${RESET} %s\n" "$1"; }

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "$1 not found in PATH. Install it and re-run setup."
    exit 1
  fi
}

require node
require npm

info "Installing JS dependencies (Expo + React Native)…"
(cd "$REPO_ROOT" && npm install)

if [ ! -f "$REPO_ROOT/.env" ]; then
  info "Creating .env from .env.example"
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
else
  warn ".env already exists — leaving it alone."
fi

if [ -d "$LIBRAS_DIR" ]; then
  info "Setting up the Libras recognition Python env…"
  # MediaPipe ships wheels for Python 3.11–3.13. Avoid 3.14 (no wheels yet).
  PYTHON_BIN=""
  for candidate in python3.12 python3.11 python3.13 python3.10 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PY_VER=$("$candidate" -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")' 2>/dev/null || echo "")
      case "$PY_VER" in
        3.10|3.11|3.12|3.13)
          PYTHON_BIN="$candidate"
          break
          ;;
      esac
    fi
  done
  if [ -z "$PYTHON_BIN" ]; then
    error "Need Python 3.10–3.13 for MediaPipe wheels. Install one (e.g. 'brew install python@3.12') and re-run setup."
    exit 1
  fi
  info "Using $PYTHON_BIN ($PY_VER)"

  if [ ! -d "$LIBRAS_DIR/.venv" ]; then
    info "Creating virtualenv at $LIBRAS_DIR/.venv"
    "$PYTHON_BIN" -m venv "$LIBRAS_DIR/.venv"
  fi
  # shellcheck disable=SC1091
  source "$LIBRAS_DIR/.venv/bin/activate"
  pip install --upgrade pip
  pip install -r "$LIBRAS_DIR/requirements.txt"
  deactivate

  if [ ! -f "$LIBRAS_DIR/models/knn_model.joblib" ]; then
    warn "Trained KNN model not found in $LIBRAS_DIR/models/. Run 'npm run libras:train' once you have a dataset."
  fi
else
  warn "Libras model folder not found — skipping Python setup."
fi

if [ -d "$AGENT_DIR" ]; then
  if [ ! -f "$AGENT_DIR/.env" ] && [ -f "$AGENT_DIR/.env.example" ]; then
    info "Creating vision-agent/.env from .env.example"
    cp "$AGENT_DIR/.env.example" "$AGENT_DIR/.env"
  fi
fi

cat <<EOF

${GREEN}Setup finished.${RESET}

Next steps:
  1. Fill the secrets in .env  (Clerk, Stream, PostHog).
  2. Add OPENAI_API_KEY to vision-agent/.env  (voice teacher).
  3. Start the Libras vision API:
       source "$LIBRAS_DIR/.venv/bin/activate"
       python "$LIBRAS_DIR/api_server.py"
     or  ${YELLOW}npm run libras:api${RESET}
  4. Start the AI voice teacher (optional but recommended):
       cd vision-agent && uv run main.py serve
  5. Start the Expo app:
       npm run start

EOF
