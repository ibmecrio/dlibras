#!/usr/bin/env bash
# Setup DLibras backend on VPS — runs FastAPI in Docker on port 8801 internal.
# Routing pra subdomínio é feito via Nginx Proxy Manager (UI :81) manualmente.
set -euo pipefail

cd /opt/dlibras

# 1. Dockerfile pro FastAPI
cat > Dockerfile.api << 'DOCKERFILE'
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (cache layer)
COPY libras-vision/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir 'fastapi==0.115.0' 'uvicorn[standard]==0.30.6' 'python-multipart==0.0.9'

# Copy code (lighter — só o que importa pra runtime)
COPY libras-vision/api_server.py .
COPY libras-vision/extract.py .
COPY libras-vision/landmark_extractor.py .
COPY libras-vision/libras_vision.py .
COPY libras-vision/knn_model.py .
COPY libras-vision/svm_model.py .
COPY libras-vision/mlp_model.py .
COPY libras-vision/random_forest_model.py .
COPY libras-vision/logistic_regression_model.py .
COPY libras-vision/models /app/models

EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s \
  CMD curl -fsS http://localhost:8001/health || exit 1

CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
DOCKERFILE

# 2. .env file (server-side keys)
if [ ! -f .env ]; then
cat > .env << 'ENVFILE'
DLIBRAS_ALLOWED_ORIGINS=*
DLIBRAS_PROXY_SECRET=__GENERATE_A_SECRET_HERE__
# Adicione suas keys de IA aqui pra ativar o proxy mode (opcional pra começar)
# ANTHROPIC_API_KEY=
# ELEVENLABS_API_KEY=
# ASSEMBLYAI_API_KEY=
ENVFILE
fi

# 3. docker-compose.yml
cat > docker-compose.yml << 'COMPOSE'
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    container_name: dlibras-api
    restart: unless-stopped
    ports:
      - "8801:8001"  # porta externa única (8001 já ocupada por outro projeto)
    env_file:
      - .env
    networks:
      - dlibras-net
      - nginx-proxy-manager_default  # pra NPM conseguir rotear
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      start_period: 30s
      retries: 3

networks:
  dlibras-net:
    driver: bridge
  nginx-proxy-manager_default:
    external: true
COMPOSE

# 4. Build + up
echo "=== Building image (vai demorar 2-3min na 1ª vez) ==="
docker compose build api 2>&1 | tail -8

echo "=== Starting container ==="
docker compose up -d 2>&1 | tail -3

echo "=== Waiting for healthcheck ==="
for i in $(seq 1 30); do
  if curl -sf http://localhost:8801/health > /dev/null 2>&1; then
    echo "✅ API UP after ${i}x 2s"
    break
  fi
  sleep 2
done

echo "=== Health response ==="
curl -s http://localhost:8801/health | head -3
echo ""
echo "=== Container status ==="
docker ps --filter "name=dlibras-api" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
