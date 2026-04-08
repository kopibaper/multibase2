# Local Development Setup

This guide covers running Multibase entirely on your local machine for development.

---

## Prerequisites

- Docker + Docker Compose v2
- Node.js 20+
- Python 3.10+

---

## 1. Start Shared Infrastructure

```bash
# Copy environment template (first time only)
cp shared/.env.shared.example shared/.env.shared

# Start shared stack (DB, Studio, Analytics, Nginx Gateway, …)
cd shared
docker compose -f docker-compose.shared.yml -f docker-compose.override.yml --env-file .env.shared up -d
```

> **Linux vs. Windows:** Check `NGINX_BIND_HOST` in `shared/.env.shared` before starting. Set `127.0.0.1` on Linux, `0.0.0.0` on Windows/Docker Desktop. See [Nginx Gateway Notes](/setup/development/nginx-gateway) for details.

---

## 2. Start the Backend

```bash
cd dashboard/backend

# First time only
cp .env.example .env          # Contains DEPLOYMENT_MODE=local by default

npm install
npm run build
npm start                     # or: npm run dev  (watch mode)
```

The API is available at `http://localhost:3000`.

---

## 3. Start the Frontend

```bash
cd dashboard/frontend

# First time only
cp .env.example .env

npm install
npm run dev
```

The dashboard is available at `http://localhost:5173`.

---

## DEPLOYMENT_MODE

The `dashboard/backend/.env` contains a key that controls behaviour:

| Value | Effect |
|---|---|
| `local` | Skips domain/SSL config, ports bound directly to localhost |
| `cloud` | Full nginx + SSL + subdomain routing (production) |

---

## Creating a Test Instance

With shared infra and the backend running:

```bash
python3 supabase_manager.py create my-test --base-port 9000
```

Or use the dashboard UI at `http://localhost:5173`.

---

## Useful Commands

```bash
# Shared infra status
docker compose -f shared/docker-compose.shared.yml ps

# Nginx gateway logs (live)
docker logs -f multibase-nginx-gateway

# Validate nginx config
docker exec multibase-nginx-gateway nginx -t

# Reload nginx (zero downtime)
docker exec multibase-nginx-gateway nginx -s reload

# List all project databases
python3 setup_shared.py list-dbs
```
