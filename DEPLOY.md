# DLibras — Deploy / Produção

## Status atual (snapshot)

| Feature | Status | Onde |
|---------|--------|------|
| ✅ Push notifications diárias | Pronto (precisa EAS Build pra agendar) | `lib/notifications.ts` + profile |
| ✅ Modo offline | Pronto (banner global + cache SW) | `components/OfflineBanner.tsx` + `public/sw.js` |
| ✅ Histórico Bia | Pronto, persistido no AsyncStorage | `app/ask-bia.tsx` + store v5 |
| ✅ Sons wrong/correct | Pronto (Web Audio API + Haptics) | `lib/audio.ts` |
| ✅ i18n pt-BR/en/es | Pronto, custom (sem dep externa) | `lib/i18n.ts` |
| ✅ Real-time WebSocket | Pronto, fallback HTTP | `api_server.py` + `LibrasCamera` |
| ✅ Ensemble 6 modelos | Pronto, selecionável no profile | KNN/SVM/MLP/RF/LR/Ensemble |
| ✅ PWA universal | Pronto, Service Worker + manifest | iOS Safari + Android Chrome |
| ⚠️ LSTM motion (J/Z) | Pendente — faltam arquivos `.pt` no repo | api responde `files_missing` |
| ⚠️ Voice realtime Stream | Pendente — precisa EAS Build | já arquivado em `lib/_archive/` |
| ⚠️ Server-side keys proxy | TODO crítico pra prod | descrito abaixo |


Roteiro completo pra tirar o DLibras do `localhost` e botar pra ar em três frentes:

1. **App mobile** (iOS/Android) — via EAS Build + lojas
2. **Web/PWA** — via Vercel/Netlify
3. **API de Visão (FastAPI)** — via Railway/Fly.io/Render

---

## 1. Segredos no client → mover pro server

**Hoje** as keys são prefixadas com `EXPO_PUBLIC_*` e vão direto pro bundle. Isso é OK em dev / TCC, **inaceitável em prod** — qualquer pessoa que abrir o bundle vê:

- `EXPO_PUBLIC_ANTHROPIC_API_KEY`
- `EXPO_PUBLIC_ELEVENLABS_API_KEY`
- `EXPO_PUBLIC_ASSEMBLYAI_API_KEY`
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (essa é segura — é a public)

### Solução: backend proxy

Criar um endpoint próprio que fala com cada provider e expõe pro app só com auth Clerk. Exemplo:

```
POST  /api/bia/chat              → proxy pra Anthropic
POST  /api/bia/tts               → proxy pra ElevenLabs
POST  /api/bia/stt               → proxy pra AssemblyAI
```

O backend valida o session token do Clerk (Bearer JWT) antes de aceitar a chamada.

Opções rápidas:
- **Vercel Edge Functions** — barato, deploy junto com o site web
- **Cloudflare Workers** — globally distribuído, free tier generoso
- **Hono + Bun** — fácil de hostar no Fly.io

Depois disso, no `lib/claude.ts`, `lib/voice.ts`, `lib/stt.ts` trocar a URL pra apontar pro próprio proxy, e remover os `EXPO_PUBLIC_*` keys.

---

## 2. App mobile (iOS/Android)

### Pré-requisitos
- Conta Apple Developer ($99/ano)
- Conta Google Play ($25 lifetime)
- Conta Expo (free)

### Comandos

```bash
# Configura EAS Build (uma vez)
pnpm dlx eas-cli login
pnpm dlx eas-cli build:configure

# Build de produção
pnpm dlx eas-cli build -p ios --profile production
pnpm dlx eas-cli build -p android --profile production

# Submit pras lojas
pnpm dlx eas-cli submit -p ios --latest
pnpm dlx eas-cli submit -p android --latest
```

### Antes do build

1. `app.config.js` — incrementar `version` (`1.0.0` → `1.0.1`)
2. Trocar `bundleIdentifier`/`package` se for fork (`com.faculdade.dlibras` está OK)
3. Substituir ícones (`assets/images/icon.png`, `splash-icon.png`) por arte final
4. **Remover keys do .env do client** (passo 1 acima)

### Stream Video / WebRTC

A pasta `lib/_archive/voice-mode.dev-build-only.tsx.bak` tem o voice mode original com Stream. Pra reativar precisa:

- Voltar `_voice-mode.tsx` pra usar o Stream Video SDK
- EAS Build (não Expo Go) — `@stream-io/react-native-webrtc` é módulo nativo
- Backend pra emitir Stream tokens (`app/api/stream-token+api.ts` já existe)

Atualmente o modo voz é HTTP-only (Claude+ElevenLabs+AssemblyAI), o que é mais barato e funciona no web — recomendo manter assim e só voltar pro Stream se precisar de latência sub-100ms.

---

## 3. Web / PWA

### Build estático

```bash
pnpm exec expo export -p web
# saída em dist/
```

### Hospedagem

**Vercel** (recomendado — zero config):
```bash
pnpm dlx vercel --prod
```

**Netlify**:
```bash
pnpm dlx netlify-cli deploy --prod --dir=dist
```

**Cloudflare Pages**: drag-and-drop do `dist/`.

### Configuração de domínio

Apontar `dlibras.app` (ou seu domínio) pra Vercel/Netlify. **HTTPS é mandatório** — sem ele a câmera e o microfone não funcionam no browser.

### Manifesto PWA

Já está em `public/manifest.webmanifest`. O `app/+html.tsx` injeta o `<link rel="manifest">`. Pra completar:

- [ ] Gerar ícones em vários tamanhos (192, 384, 512, 1024) e referenciar no manifest
- [ ] Service worker pra cache offline — opcional, mas vira PWA "instalável" de verdade
- [ ] Testar com Lighthouse → PWA score 90+

O botão **"Instalar como app"** no `/profile` já está conectado ao evento `beforeinstallprompt` do browser. Vai aparecer só em Chrome/Edge no desktop e Android (Safari iOS não emite o evento, mas o user pode usar "Add to Home Screen" manual).

---

## 4. API de Visão (FastAPI)

A pasta `Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition/` tem o servidor MediaPipe + KNN. Hoje roda em `localhost:8001`.

### Containerizar

Criar `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Deploy

**Railway** (mais simples):
1. New project → Deploy from GitHub
2. Apontar pra repositório da API
3. Setar `PORT=8001`
4. Pegar URL pública e setar `EXPO_PUBLIC_LIBRAS_API_URL=https://....up.railway.app` no client de prod

**Fly.io** (mais barato em escala):
```bash
fly launch
fly deploy
```

**Render** (free tier mata por inatividade — só pra demo).

### CORS

Garantir que `api_server.py` aceita origens do domínio do site web:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dlibras.app", "https://*.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Modelo

O KNN treinado fica em `models/`. Subir junto no Docker. Se for grande (>100MB), guardar em S3/R2 e baixar no startup.

---

## 5. Checklist pré-produção

- [ ] **Keys client → server proxy** (Anthropic, ElevenLabs, AssemblyAI)
- [ ] **Clerk em modo prod** (trocar `pk_test_*` por `pk_live_*`, configurar domínio autorizado)
- [ ] **Sentry/PostHog** ligados pra error tracking + analytics
- [ ] **Rate limit** no proxy (ex.: 50 chamadas/min por user)
- [ ] **CORS** restrito no FastAPI
- [ ] **HTTPS** em todos os hosts
- [ ] **Ícone PWA** em todos os tamanhos
- [ ] **Service worker** (opcional — PWA offline-first)
- [ ] **Lighthouse score 90+** em Performance/Accessibility/SEO
- [ ] **Stream/RealTime** decisão final (manter HTTP ou voltar pro Stream)
- [ ] **Modelo Libras** com mais dados (vimos que H/J/K/X/Z exigem motion — treinar LSTM completo)
- [ ] **Internationalization** (i18n) — só pt-BR hoje, mas o app pode ir pra outras línguas de sinais
- [ ] **Onboarding** mais robusto (vídeo tutorial)
- [ ] **Notificações push** (lembrete diário de praticar — Duolingo-style)
- [ ] **Sistema de hearts/vidas** (perde vida quando erra, regen com tempo)
- [ ] **Leaderboard** de XP semanal entre amigos

---

## 6. Custos estimados (mensais, modo conservador)

| Serviço | Free tier | Plano pago |
|---------|-----------|-----------|
| Vercel (web) | suficiente | $20 (Hobby OK) |
| Railway (FastAPI) | 500h/mês | $5/serviço |
| Anthropic Haiku 4.5 | — | ~$0.001 por mensagem da Bia |
| ElevenLabs | 10k chars/mês | $5 → 30k chars |
| AssemblyAI | 5h/mês | $0.37/h |
| Clerk | 10k MAU | $25 |
| EAS Build | 30 builds/mês | $19 |
| **Total demo (TCC)** | **$0** | — |
| **Total prod (~1k MAU)** | — | **~$80/mês** |

---

## 7. Próximos passos imediatos

Pra você focar primeiro:

1. ✅ Fazer um deploy de **demo** (sem keys reais) no Vercel pra mostrar pra banca
2. ✅ Subir o vídeo demo no YouTube + link no README
3. ⏳ Pegar feedback de usuário final (alguém da comunidade surda)
4. ⏳ Treinar LSTM motion model (vimos que J/Z heurística não é confiável)

**Para o TCC**: o que tá pronto já passa em qualquer banca. Foca em escrever a memória e gravar um vídeo de demonstração antes de buscar prod.
