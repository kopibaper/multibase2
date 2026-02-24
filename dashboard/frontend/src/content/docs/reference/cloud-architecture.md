---
title: Cloud Architecture
description: Shared Infrastructure implementation log and architecture reference
---

# ☁️ Cloud Architecture - Implementation Log

**Status:** ✅ Complete (all 8 phases implemented)  
**Branch:** `cloud-version`

---

## Architecture Overview

Multibase Cloud replaces the classic "full-stack per tenant" model with a **shared infrastructure** approach:

| Layer | Containers | Scope |
|-------|-----------|-------|
| **Shared Services** | 8 | One set for all tenants |
| **Per-Tenant Services** | 5 | Lightweight, tenant-specific |

### Shared Services (8 containers)

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| PostgreSQL | `multibase-db` | 5432 | Shared database with per-tenant schemas |
| Studio | `multibase-studio` | 3100 | Supabase Dashboard UI |
| Analytics | `multibase-analytics` | 4000 | Logflare-based log analytics |
| Vector | `multibase-vector` | — | Log collection & routing |
| imgproxy | `multibase-imgproxy` | 5001 | Image transformation |
| Pooler | `multibase-pooler` | 5432 | Supavisor connection pooling |
| Meta | `multibase-meta` | 8080 | PostgreSQL metadata API |
| Nginx Gateway | `multibase-nginx-gateway` | 8000 | Reverse proxy for all tenants |

### Per-Tenant Services (5 containers each)

| Service | Container Pattern | Purpose |
|---------|------------------|---------|
| Auth (GoTrue) | `{tenant}-auth` | Authentication & JWT |
| REST (PostgREST) | `{tenant}-rest` | Auto-generated REST API |
| Realtime | `{tenant}-realtime` | WebSocket subscriptions |
| Storage | `{tenant}-storage` | File storage API |
| Edge Functions | `{tenant}-edge-functions` | Deno-based serverless |

---

## Resource Comparison

| Metric | Classic (5 tenants) | Cloud (5 tenants) | Savings |
|--------|--------------------|--------------------|---------|
| Containers | 60+ | 33 | −45% |
| RAM | ~15 GiB | ~8 GiB | ~7 GiB |
| Per-Tenant Overhead | ~2.5 GiB | ~0.5 GiB | −80% |

---

## Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Planning & Architecture | ✅ Done |
| 1 | Shared DB + Studio | ✅ Done |
| 2 | Shared Analytics, Vector, imgproxy | ✅ Done |
| 3 | Shared Pooler (Supavisor) + Meta | ✅ Done |
| 4 | Lightweight Tenant Template | ✅ Done |
| 5 | Nginx Gateway (replaces Kong) | ✅ Done |
| 6 | setup_shared.py Orchestration | ✅ Done |
| 7 | Dashboard Integration | ✅ Done |
| 8 | Resource Monitoring | ✅ Done |

---

## Key Files

| File | Purpose |
|------|---------|
| `shared/docker-compose.shared.yml` | 8 shared service definitions |
| `templates/docker-compose.yml.j2` | Lightweight 5-container tenant template |
| `setup_shared.py` | Orchestration: start/stop/create/delete + nginx config generation |
| `nginx/sites-enabled/*.conf` | Auto-generated per-tenant nginx routing configs |
| `dashboard/backend/src/services/SharedInfraManager.ts` | Backend service for shared container management |
| `dashboard/frontend/src/pages/SharedInfra.tsx` | SharedInfra dashboard with GaugeCharts |

---

## How It Works

### Tenant Creation

```
setup_shared.py create <tenant-name>
```

1. Generates `.env` from template with unique ports + JWT secrets
2. Renders `docker-compose.yml` from Jinja2 template (5 containers only)
3. Generates nginx config in `nginx/sites-enabled/{tenant}.conf`
4. Reloads nginx gateway (`docker exec multibase-nginx-gateway nginx -s reload`)
5. Starts tenant containers

### Nginx Gateway Routing

Each tenant gets a generated nginx config with deferred DNS resolution:

```nginx
# Deferred DNS resolution for Docker networking
resolver 127.0.0.11 valid=10s;

server {
    listen 8000;
    server_name ~^(?<tenant>.+)\.example\.com$;

    location /rest/v1/ {
        set $upstream http://${tenant}-rest:3000;
        proxy_pass $upstream;
    }
    # ... auth, realtime, storage, edge-functions
}
```

---

[← Back to Version Overview](/setup/general/versions)
