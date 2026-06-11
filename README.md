# DLibras

> Aprenda a Língua Brasileira de Sinais com câmera, IA e voz natural.
> TCC — projeto de conclusão de curso voltado para inclusão digital e acessibilidade.

App estilo Duolingo focado em ensinar o alfabeto manual da Libras, palavras
soletradas e letras com movimento (J, Z). Reconhece os sinais em tempo real
pela câmera do dispositivo via FastAPI + MediaPipe + scikit-learn, e tem a
**Bia** (professora IA) explicando cada gesto em português brasileiro com
voz neural natural.

| Plataforma | Status |
|------------|--------|
| 📱 iOS / Android (Expo Go + EAS Build) | ✅ |
| 💻 Web (PWA instalável) | ✅ |
| 🎥 Reconhecimento real-time WebSocket | ✅ |
| 🦊 Tutor IA (Claude + ElevenLabs + AssemblyAI) | ✅ |

---

## Stack

- **Frontend**: React Native 0.81 · Expo SDK 54 · Expo Router 6 · NativeWind v5 · Reanimated 4 · Zustand
- **Backend de visão**: FastAPI · MediaPipe HandLandmarker · scikit-learn (KNN, SVM, MLP, RandomForest, Logistic Regression + Ensemble) — em **[repositório separado](https://github.com/ibmecrio/Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition)**
- **AI**: Anthropic Claude Haiku 4.5 · ElevenLabs Multilingual v2 · AssemblyAI (STT pt-BR)
- **Auth**: Clerk (com modo demo / dev-bypass)
- **Analytics**: PostHog (autocapture)
- **CI/Deploy**: Docker Compose · Nginx · Let's Encrypt · Postgres

---

## Features

- 🎮 Sistema completo Duolingo-style: XP, sequência de dias, hearts (vidas), conquistas, quiz
- 🦊 **Bia, professora IA** — explica cada letra passo-a-passo via Claude → ElevenLabs (voz feminina natural pt-BR)
- 🎤 Push-to-talk: aluno pergunta por voz, AssemblyAI transcreve, Claude responde, ElevenLabs fala
- 📷 Câmera reconhece A-W em tempo real (KNN/SVM/MLP/RF/LR/Ensemble selecionável)
- ⚡ Real-time via WebSocket (`/predict-ws`) com fallback HTTP
- 🌍 i18n pt-BR / en / es
- 🌓 Light / Dark / System theme
- 🏆 12 conquistas + heatmap A-Z de proficiência
- 🔔 Push notifications diárias (EAS Build)
- 📲 PWA instalável (Service Worker + manifest, install no Chrome/Edge, "Add to Home Screen" no iOS Safari)
- ♿ Acessibilidade: VoiceOver labels, `prefers-reduced-motion`, error boundary, focus management
- 💬 Histórico de conversas com a Bia (persistido)
- 📊 Stats: streak warning, daily goal celebration, XP float popup, letter accuracy

---

## Como rodar

### Requisitos
- Node 20+, [pnpm 10+](https://pnpm.io/installation)
- Python 3.10–3.13 (MediaPipe não tem wheel pro 3.14)
- Expo Go no celular ou simulador iOS/Android

### Setup

```bash
pnpm install --shamefully-hoist

# em outro terminal: o backend de visão (repo separado)
git clone https://github.com/ibmecrio/Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition.git libras-vision
cd libras-vision
python -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn api_server:app --host 0.0.0.0 --port 8001
```

### Variáveis de ambiente (`.env`)

```bash
# Auth (opcional — sem ela o app entra em modo demo)
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# IA — em PROD prefira o proxy server-side (USE_PROXY=true) pra não vazar
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-api03-...
EXPO_PUBLIC_ELEVENLABS_API_KEY=sk_...
EXPO_PUBLIC_ASSEMBLYAI_API_KEY=842...

# URL da Vision API (deixe vazio = auto-discover via Expo bundler ou window.location)
# EXPO_PUBLIC_LIBRAS_API_URL=

# Proxy mode (recomendado pra prod — keys vão pro server)
# EXPO_PUBLIC_USE_PROXY=true
# EXPO_PUBLIC_PROXY_SECRET=<bearer token>
```

### Rodar

```bash
pnpm exec expo start --host lan --clear --web
```

- 💻 Web: http://localhost:8081
- 📱 Mobile: scan QR no Expo Go

---

## Deploy em produção

Documentação completa em [`DEPLOY-DOCKER.md`](./DEPLOY-DOCKER.md). Resumo:

```bash
# No servidor (Ubuntu/Debian, com Docker + DNS apontando pro IP):
./deploy.sh
```

Sobe 5 serviços via `docker-compose`:
- `nginx` (TLS + reverse proxy + Let's Encrypt)
- `web` (build estático Expo + Nginx interno)
- `api` (FastAPI + MediaPipe + ML models)
- `db` (Postgres 16)
- `certbot` (renovação automática SSL)

---

## Roadmap

- [ ] Modelo LSTM motion treinado (J/Z hoje usa heurística)
- [ ] Voice realtime via WebRTC (Stream/OpenAI Realtime) — exige EAS Build
- [ ] Leaderboard semanal de XP entre amigos
- [ ] Lottie animado do mascote fazendo cada sinal
- [ ] Mais conteúdo: palavras, frases, diálogos

---

## TCC

Projeto de conclusão de curso (IBMEC RJ).

**Aluno:** Anderson Lima
**Tema:** Inclusão digital via reconhecimento de Libras com Computer Vision e IA
**ODS alinhados:**
- 🎓 ODS 4 — Educação de qualidade
- 🤝 ODS 10 — Redução das desigualdades

Mais info na tela **Sobre** dentro do app, ou no PDF da memória descritiva.

---

## Licença

MIT © 2026 Anderson Lima
