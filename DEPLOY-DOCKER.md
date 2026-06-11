# DLibras — Docker Deploy Playbook

End-to-end guide for putting DLibras live at **`https://dlibras.app`** (server IP `187.77.253.138`) using the Docker setup in this repo.

```
┌──────────────────────────────────────────────────────────────────┐
│                    nginx (TLS, ports 80/443)                     │
│        ┌──────────────────────┴──────────────────────┐           │
│        │                                             │           │
│        ▼                                             ▼           │
│   web (Expo static, nginx:alpine)            api (FastAPI 8001)  │
│                                                      │           │
│                                                      ▼           │
│                                              db (Postgres 16)    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 0. Prerequisites

### On the server (`187.77.253.138`)

| Requirement       | Check                                                            |
|-------------------|------------------------------------------------------------------|
| OS                | Ubuntu 22.04 LTS (or any Debian-family with Docker support)      |
| Docker Engine     | `docker --version` → `>= 24.0`                                   |
| Docker Compose v2 | `docker compose version` → `>= 2.20`                             |
| Open ports        | `80/tcp` and `443/tcp` reachable from the internet               |
| Disk              | `>= 10 GB` free in `/var/lib/docker` (MediaPipe + models)        |
| RAM               | `>= 2 GB` (4 GB recommended — uvicorn 2 workers + Postgres)      |

Install Docker if missing:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out / back in
```

Open the firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### On your laptop

* `ssh` keys configured for `root@187.77.253.138` (or whatever user owns `/opt/dlibras`).
* `rsync`, `docker`, `docker compose` for local sanity checks (optional).

### DNS

Point both records to the server:

| Type | Name              | Value             | TTL  |
|------|-------------------|-------------------|------|
| A    | `dlibras.app`     | `187.77.253.138`  | 300  |
| A    | `www.dlibras.app` | `187.77.253.138`  | 300  |

Verify:

```bash
dig +short dlibras.app
dig +short www.dlibras.app
# both should print 187.77.253.138
```

---

## 1. First deploy (one-time setup)

### 1.1 Prepare the env file (locally)

```bash
cp docker/.env.production.example docker/.env.production
$EDITOR docker/.env.production
```

Fill in:

* `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ASSEMBLYAI_API_KEY` — server-side AI keys.
* `DLIBRAS_PROXY_SECRET` and `EXPO_PUBLIC_PROXY_SECRET` — must be **identical**.
* `POSTGRES_PASSWORD` — strong random string.
* `DATABASE_URL` — has to match the new password.
* `LETSENCRYPT_EMAIL` — used for renewal notifications.

> The file is gitignored (`.env*` in `.gitignore`) — never commit it.

### 1.2 Push the project to the server

Pick one of:

**Option A — one-liner with `deploy.sh`:**

```bash
./deploy.sh
```

`deploy.sh` will rsync the repo to `/opt/dlibras`, upload `docker/.env.production`, build images on the server, and start the stack.

**Option B — manual:**

```bash
ssh root@187.77.253.138 'mkdir -p /opt/dlibras'
rsync -az --delete \
    --exclude='.git/' --exclude='node_modules/' --exclude='.expo/' \
    --exclude='dist/' --exclude='.venv/' --exclude='__pycache__/' \
    --exclude='/ios/' --exclude='/android/' \
    ./ root@187.77.253.138:/opt/dlibras/

rsync -az docker/.env.production root@187.77.253.138:/opt/dlibras/docker/.env.production
ssh root@187.77.253.138 'chmod 600 /opt/dlibras/docker/.env.production'
```

### 1.3 First build (HTTP only — TLS not yet ready)

The nginx config references `dlibras.app` certs that don't exist yet, so for the very first run we issue the certificate via the ACME http-01 challenge over plain HTTP.

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && \
    docker compose --env-file docker/.env.production build && \
    docker compose --env-file docker/.env.production up -d db api web'
```

Then bring nginx up in **http-only** mode by temporarily renaming the TLS server block. Easiest path: spin up a throwaway nginx that only serves the challenge:

```bash
ssh root@187.77.253.138 'docker run --rm -d \
    --name dlibras-acme \
    -p 80:80 \
    -v dlibras_certbot-www:/var/www/certbot \
    nginx:alpine \
    sh -c "mkdir -p /var/www/certbot && \
           printf \"server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 200 \\\"ok\\\"; } }\" > /etc/nginx/conf.d/default.conf && \
           nginx -g \"daemon off;\""'
```

Issue the cert:

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose --env-file docker/.env.production run --rm certbot \
    certonly --webroot -w /var/www/certbot \
    -d dlibras.app -d www.dlibras.app \
    --email admin@dlibras.app --agree-tos --no-eff-email --non-interactive'
```

Stop the throwaway nginx:

```bash
ssh root@187.77.253.138 'docker stop dlibras-acme || true'
```

> Alternative (simpler if no other service uses port 80): run `certbot certonly --standalone -d dlibras.app -d www.dlibras.app` on the host directly, then point the volume mount at `/etc/letsencrypt` on disk.

### 1.4 Bring up the full stack with TLS

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && \
    docker compose --env-file docker/.env.production up -d'
```

Verify:

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose ps'
curl -I https://dlibras.app
curl -fsS https://dlibras.app/health   # FastAPI proxied through nginx
```

If everything is green you should see:

* `https://dlibras.app/` → DLibras web app.
* `https://dlibras.app/health` → `{"status": "ok", ...}` from FastAPI.
* `https://dlibras.app/predict-ws` → WebSocket upgrade.

---

## 2. Subsequent deploys (updates)

After the first deploy, day-to-day pushes are:

```bash
./deploy.sh
```

That command will:

1. `rsync` changed files (no `.git/`, no `node_modules/`, no datasets).
2. Re-upload `docker/.env.production` (only if it changed locally).
3. `docker compose build` on the server (uses BuildKit layer cache).
4. `docker compose up -d` to roll containers in place.
5. `curl` the public URL as a smoke test.

To deploy only one service (e.g. API after a Python tweak):

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && \
    docker compose --env-file docker/.env.production build api && \
    docker compose --env-file docker/.env.production up -d api'
```

To rebuild the web bundle only (e.g. after changing UI):

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && \
    docker compose --env-file docker/.env.production build web && \
    docker compose --env-file docker/.env.production up -d web nginx'
```

---

## 3. Certificate renewal

The `certbot` service in `docker-compose.yml` runs `certbot renew` every 12 hours. Let's Encrypt only renews when the cert is within 30 days of expiry, so this is safe to run constantly.

Manually trigger a renewal + nginx reload:

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && \
    docker compose --env-file docker/.env.production run --rm certbot renew --webroot -w /var/www/certbot && \
    docker compose --env-file docker/.env.production exec nginx nginx -s reload'
```

Expiry check:

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && \
    docker compose --env-file docker/.env.production run --rm certbot certificates'
```

---

## 4. Operating the stack

### Logs

```bash
# Tail everything
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose logs -f --tail=200'

# Just the API
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose logs -f api'

# Nginx access log
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose exec nginx tail -f /var/log/nginx/access.log'
```

### Exec into a container

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose exec api bash'
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose exec db psql -U dlibras -d dlibras'
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose exec nginx sh'
```

### Restart a single service

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose --env-file docker/.env.production restart api'
```

### Full restart

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && \
    docker compose --env-file docker/.env.production down && \
    docker compose --env-file docker/.env.production up -d'
```

### Database backup

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose exec -T db \
    pg_dump -U dlibras dlibras' | gzip > "dlibras-$(date +%F).sql.gz"
```

---

## 5. Troubleshooting

### Symptom: `curl https://dlibras.app/` returns `502 Bad Gateway`

Cause: `api` or `web` upstream is down/unhealthy.

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose ps'
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose logs --tail=200 api web'
```

### Symptom: API container is restarting

Usually missing model files or a Python import error. Verify the models were synced:

```bash
ssh root@187.77.253.138 'ls -lh /opt/dlibras/Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition/models/'
# Expect: hand_landmarker.task, knn_model.joblib, label_encoder.joblib, ...
```

If empty, `deploy.sh` likely skipped them — make sure they aren't gitignored and aren't matched by `.dockerignore`/rsync excludes.

### Symptom: `nginx` won't start, complains about `/etc/letsencrypt/live/dlibras.app/fullchain.pem`

The cert hasn't been issued yet. Re-run the first-time ACME challenge in §1.3.

### Symptom: web build OOM during `pnpm exec expo export`

```bash
NODE_OPTIONS=--max-old-space-size=4096 docker compose build web
```

…or build on a beefier machine and `docker save | ssh | docker load`.

### Symptom: WebSocket disconnects after 60 s

Nginx has `proxy_read_timeout 3600s` on `/predict-ws`. If a load balancer in front of the server cuts it sooner, raise its idle timeout too.

### Symptom: CORS error in the browser console

`DLIBRAS_ALLOWED_ORIGINS` in `docker/.env.production` must include the exact origin (`https://dlibras.app`). Update and restart:

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && \
    docker compose --env-file docker/.env.production up -d api'
```

### Symptom: Old version still served

Bust the browser cache (the Expo bundle has hashed asset names, but `index.html` is `no-store`). If you customized cache headers, also reload nginx:

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose exec nginx nginx -s reload'
```

---

## 6. Cleaning up

Stop and remove everything but the database volume:

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose down'
```

**Destructive** — also wipe the Postgres volume:

```bash
ssh root@187.77.253.138 'cd /opt/dlibras && docker compose down -v'
```

Remove old image layers to reclaim disk:

```bash
ssh root@187.77.253.138 'docker image prune -f && docker builder prune -f'
```

---

## 7. File map

| Path                                      | Purpose                                                |
|-------------------------------------------|--------------------------------------------------------|
| `docker-compose.yml`                      | Stack definition (5 services).                         |
| `docker/Dockerfile.web`                   | Multi-stage Expo build → nginx static server.          |
| `docker/Dockerfile.api`                   | FastAPI + MediaPipe + KNN on python:3.11-slim.         |
| `docker/nginx.conf`                       | Public-facing TLS + reverse proxy + WebSocket.         |
| `docker/nginx.web.conf`                   | Inner nginx config for the `web` container (SPA).      |
| `docker/.env.production.example`          | Template for `docker/.env.production` (secrets).       |
| `.dockerignore`                           | Trims the build context.                               |
| `deploy.sh`                               | One-shot build + rsync + restart helper.               |
| `DEPLOY-DOCKER.md`                        | This file.                                             |

Backend code: `Digital-Inclusion-and-Accessibility-A-Computer-Vision-Model-for-Automated-Libras-Recognition/api_server.py`.
