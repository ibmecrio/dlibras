# Configurando o Subdomínio no Nginx Proxy Manager (NPM)

A VPS `187.77.253.138` roda **Nginx Proxy Manager** (`jc21/nginx-proxy-manager`) na porta 81
gerenciando todos os subdomínios dos projetos. Pra expor a API DLibras como
`api.dlibras.app` (ou outro subdomínio) sem usar IP direto:

## Passo a passo

### 1. Acessa a UI do NPM

```
http://187.77.253.138:81/
```

Login padrão (se ainda não trocou):
- Email: `admin@example.com`
- Senha: `changeme`

### 2. Aponta o DNS

No provedor do domínio (ex.: Registro.br, Cloudflare, GoDaddy), cria um **A record**:

| Tipo | Nome | Valor |
|------|------|-------|
| A | `api.dlibras.app` | `187.77.253.138` |
| A | `api` (se domínio já é dlibras.app) | `187.77.253.138` |

Espera ~5min até propagar (`dig api.dlibras.app +short` deve retornar o IP).

### 3. Cria Proxy Host no NPM

**Hosts → Proxy Hosts → Add Proxy Host**

| Campo | Valor |
|-------|-------|
| **Domain Names** | `api.dlibras.app` |
| **Scheme** | `http` |
| **Forward Hostname / IP** | `dlibras-api` _(o nome do container)_ |
| **Forward Port** | `8001` _(porta interna do container)_ |
| **Cache Assets** | ❌ desligado |
| **Block Common Exploits** | ✅ ligado |
| **Websockets Support** | ✅ **OBRIGATÓRIO** (pro `/predict-ws`) |
| **Access List** | Publicly Accessible |

### 4. SSL (aba SSL)

| Campo | Valor |
|-------|-------|
| **SSL Certificate** | Request a new SSL Certificate |
| **Force SSL** | ✅ |
| **HTTP/2** | ✅ |
| **HSTS Enabled** | ✅ (depois de testar tudo) |
| **HSTS Subdomains** | ❌ |
| **Email** | seu email |
| **I Agree** | ✅ |

Clica em **Save**. NPM dispara o desafio HTTP-01 do Let's Encrypt e em ~30s o cert sobe.

### 5. Testa

```bash
curl https://api.dlibras.app/health
# Deve retornar: {"status":"ok","labels":[...],"models_available":[...]}
```

Se der erro 502 / 504:
- Verifica que o container DLibras tá na network `nginx-proxy-manager_default`:
  ```bash
  docker network inspect nginx-proxy-manager_default | grep dlibras-api
  ```
- Reinicia o NPM: `docker compose -f /opt/nginx-proxy-manager/docker-compose.yml restart`

### 6. Atualiza CORS no DLibras API

Depois que o subdomínio funcionar via HTTPS, aperta o CORS no `.env`:

```bash
ssh -p 2222 root@187.77.253.138 \
  "sed -i 's|DLIBRAS_ALLOWED_ORIGINS=.*|DLIBRAS_ALLOWED_ORIGINS=https://dlibras.vercel.app,https://dlibras.app,https://web.dlibras.app|' /opt/dlibras/.env && \
   cd /opt/dlibras && docker compose restart api"
```

### 7. Atualiza frontend pra apontar pro subdomínio

Edita `.env` do front:

```bash
EXPO_PUBLIC_LIBRAS_API_URL=https://api.dlibras.app
EXPO_PUBLIC_USE_PROXY=true
EXPO_PUBLIC_PROXY_SECRET=<o mesmo DLIBRAS_PROXY_SECRET da VPS>
```

Depois `pnpm exec expo export -p web` → `vercel --prod`.

## Troubleshooting

| Sintoma | Solução |
|---------|---------|
| NPM UI inacessível em :81 | Firewall do hosting bloqueando. Usa túnel SSH: `ssh -p 2222 -L 81:localhost:81 root@VPS` → abre `localhost:81` localmente. |
| Cert Let's Encrypt falha "DNS problem" | DNS A record ainda não propagou. Espera mais. Verifica: `dig api.dlibras.app +short` |
| 502 Bad Gateway | Container não tá rodando ou tá fora da network. `docker compose ps`, `docker network connect nginx-proxy-manager_default dlibras-api` |
| WebSocket falha (`/predict-ws`) | Esqueceu de ligar **Websockets Support** no Proxy Host. Volta na UI e marca. |
| CORS bloqueado no browser | `DLIBRAS_ALLOWED_ORIGINS` na VPS não inclui o domínio que tá acessando. Restart api depois de mudar. |
