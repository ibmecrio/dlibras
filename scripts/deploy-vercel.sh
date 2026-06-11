#!/usr/bin/env bash
# Deploy frontend Web → Vercel.
#
# Uso:
#   ./scripts/deploy-vercel.sh          — deploy preview
#   ./scripts/deploy-vercel.sh --prod   — deploy production
#
# Pré-req: vercel CLI logado (npm i -g vercel && vercel login)

set -euo pipefail

if ! command -v vercel >/dev/null 2>&1; then
  echo "❌ Vercel CLI não instalado: npm install -g vercel"
  exit 1
fi

# Garante que vercel.json + .npmrc existem
if [ ! -f vercel.json ]; then
  echo "❌ vercel.json não encontrado na raiz"
  exit 1
fi

echo "🧹 Pré-build: tsc check + clean dist/"
pnpm exec tsc --noEmit || { echo "❌ TS errors — corrige antes"; exit 1; }
rm -rf dist/

if [ "${1:-}" = "--prod" ]; then
  echo "🚀 Deploy PRODUCTION (--prod)"
  vercel --prod --yes
else
  echo "👀 Deploy preview"
  vercel --yes
fi
