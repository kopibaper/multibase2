---
title: Cloud Architecture
description: Shared Infrastructure implementation log and architecture reference
---

# ☁️ Cloud Architecture

**Status:** ✅ Complete  
**Branch:** `cloud-version`

> Multibase Cloud replaces the classic "full-stack per tenant" model with a shared infrastructure approach — 8 shared services + 5 lightweight containers per tenant.

---

## Architecture Overview

**Status:** ✅ Implemented

### Description

Instead of running 12+ containers per project, tenants now share 8 infrastructure services and only spin up 5 tenant-specific containers. This reduces total container count by ~45% and RAM usage by ~7 GiB for 5 tenants.

### Shared Services (8 containers)

- **PostgreSQL** (`multibase-db`, Port 5432)
  - Shared database with per-tenant schemas
- **Studio** (`multibase-studio`, Port 3100)
  - Supabase Dashboard UI
- **Analytics** (`multibase-analytics`, Port 4000)
  - Logflare-based log analytics
- **Vector** (`multibase-vector`)
  - Log collection & routing
- **imgproxy** (`multibase-imgproxy`, Port 5001)
  - Image transformation service
- **Pooler** (`multibase-pooler`, Port 5432)
  - Supavisor connection pooling
- **Meta** (`multibase-meta`, Port 8080)
  - PostgreSQL metadata API
- **Nginx Gateway** (`multibase-nginx-gateway`, Port 8000)
  - Reverse proxy for all tenants

### Per-Tenant Services (5 containers each)

- **Auth / GoTrue** (`{tenant}-auth`)
  - Authentication & JWT token management
- **REST / PostgREST** (`{tenant}-rest`)
  - Auto-generated REST API
- **Realtime** (`{tenant}-realtime`)
  - WebSocket subscriptions
- **Storage** (`{tenant}-storage`)
  - File storage API
- **Edge Functions** (`{tenant}-edge-functions`)
  - Deno-based serverless functions

---

## 📊 Resource Savings

**Status:** ✅ Verified

### Description

Comparison between classic deployment (all containers per tenant) and cloud deployment (shared + lightweight).

### Comparison (5 tenants)

- **Total Containers**
  - Classic: 60+
  - Cloud: 33
  - Savings: −45%
- **Total RAM**
  - Classic: ~15 GiB
  - Cloud: ~8 GiB
  - Savings: ~7 GiB
- **Per-Tenant Overhead**
  - Classic: ~2.5 GiB
  - Cloud: ~0.5 GiB
  - Savings: −80%

---

## 🔧 Implementation Phases

**Status:** ✅ All 8 phases complete

### Description

The cloud architecture was built incrementally across 8 phases.

### Phases

- [x] **Phase 0** — Planning & Architecture
- [x] **Phase 1** — Shared DB + Studio
- [x] **Phase 2** — Shared Analytics, Vector, imgproxy
- [x] **Phase 3** — Shared Pooler (Supavisor) + Meta
- [x] **Phase 4** — Lightweight Tenant Template
- [x] **Phase 5** — Nginx Gateway (replaces Kong)
- [x] **Phase 6** — `setup_shared.py` Orchestration
- [x] **Phase 7** — Dashboard Integration
- [x] **Phase 8** — Resource Monitoring

---

## 📁 Key Files

**Status:** ✅ Reference

### Description

Important files that implement the cloud architecture.

### Infrastructure

- **`shared/docker-compose.shared.yml`**
  - Defines all 8 shared service containers
- **`templates/docker-compose.yml.j2`**
  - Jinja2 template for lightweight 5-container tenants
- **`nginx/sites-enabled/*.conf`**
  - Auto-generated per-tenant nginx routing configs

### Orchestration

- **`setup_shared.py`**
  - Main CLI: start, stop, create, delete
  - Generates nginx configs and manages shared stack

### Dashboard

- **`dashboard/backend/src/services/SharedInfraManager.ts`**
  - Backend service for shared container management
- **`dashboard/frontend/src/pages/SharedInfra.tsx`**
  - SharedInfra dashboard page with GaugeCharts

---

## 🚀 How It Works

### Tenant Creation

```bash
python setup_shared.py create <tenant-name>
```

**What it does:**

1. ✅ Generates `.env` from template with unique ports + JWT secrets
2. ✅ Renders `docker-compose.yml` from Jinja2 template (5 containers only)
3. ✅ Generates nginx config in `nginx/sites-enabled/{tenant}.conf`
4. ✅ Reloads nginx gateway via `docker exec multibase-nginx-gateway nginx -s reload`
5. ✅ Starts tenant containers

### Nginx Gateway Routing

Each tenant gets a generated nginx config with deferred DNS resolution:

```nginx
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

> See [Kong → Nginx Migration](/setup/reference/kong-nginx-migration) for full config details and technical decisions.

---

## Next Steps

Planned additions to the cloud architecture:

- [ ] 🏢 Multi-Tenancy/Teams — Organization support with isolated instances
- [ ] 💰 Cost Tracking — Per-tenant resource usage and billing
- [ ] 💾 S3 Storage — Backup offloading to S3-compatible storage

See [Version 1.3 Roadmap](/setup/features/roadmap-1.3) for all planned features.

[← Back to Version Overview](/setup/general/versions)
