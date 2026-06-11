# server/

Arquivos **adicionais** do backend que NÃO vivem no repo de visão original
(`ibmecrio/Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition`).

O repo upstream tem só o pipeline de ML (treino + modelos). Estes arquivos
extendem ele pra rodar como API HTTP + WebSocket + proxy de IA:

| Arquivo | O que faz |
|---------|-----------|
| `api_server.py` | FastAPI completo: GET /health, POST /predict, /predict-landmarks, /predict-motion(-v2), WS /predict-ws, proxies /api/anthropic, /api/elevenlabs, /api/assemblyai. Carrega 6 modelos (KNN + SVM + MLP + RF + LR + Ensemble) + MediaPipe. |
| `Dockerfile.api` | Imagem `python:3.11-slim` com libs do MediaPipe (libgl1, libegl1, libgles2 etc.). Build context é a raiz do projeto + clone do repo de visão. |
| `docker-compose.yml` | Sobe `dlibras-api` na porta 8801 externa, conectado à network `nginx-proxy-manager_default` pra roteamento de subdomínio. |
| `setup.sh` | Script idempotente que clona o repo upstream, escreve Dockerfile/compose/.env (vazio se não existe), builda imagem e faz `docker compose up -d`. |
| `nginx-npm-instructions.md` | Como adicionar o subdomínio na UI do Nginx Proxy Manager (porta 81 da VPS). |
| `.env.production.example` | Template das vars server-side (Anthropic, ElevenLabs, AssemblyAI, Proxy Secret, CORS). |

## Deploy na VPS

```bash
# Do seu Mac
scp -P 2222 -r server/* root@VPS:/opt/dlibras/
ssh -p 2222 root@VPS 'bash /opt/dlibras/setup.sh'
```

## Atualizar deploy após mudança

```bash
# Localmente: edita api_server.py
scp -P 2222 server/api_server.py root@VPS:/opt/dlibras/libras-vision/
ssh -p 2222 root@VPS 'cd /opt/dlibras && docker compose build api && docker compose up -d'
```

## Sincronizar repo de visão upstream

```bash
ssh -p 2222 root@VPS 'cd /opt/dlibras/libras-vision && git pull'
# Mas reescreve nosso api_server.py — sempre re-scp depois.
ssh -p 2222 root@VPS 'cd /opt/dlibras && bash setup.sh'
```
