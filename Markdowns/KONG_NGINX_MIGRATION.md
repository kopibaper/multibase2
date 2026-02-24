# Kong → Nginx Gateway Migration

> **Status:** ✅ Complete (February 2026)
>
> This document was the planning reference for replacing all per-tenant Kong API gateways with a single shared Nginx container. It now serves as a **post-migration reference** for future developers.

## Result

| Metric | Before (Kong) | After (Nginx) |
|--------|---------------|---------------|
| **Containers per tenant** | 6 (incl. Kong) | 5 (no Kong) |
| **Gateway RAM total** | ~7 GiB (5× Kong) | ~20 MB (1× Nginx) |
| **Config reload** | `kong reload` (~1s) | `nginx -s reload` (~50ms) |
| **API key check** | key-auth plugin | `map` + header check |
| **WebSocket** | Automatic | Explicit `upgrade` headers |

### Key Technical Decisions

1. **Docker DNS deferred resolution:** `set $var "hostname:port"; proxy_pass http://$var;` with `resolver 127.0.0.11` — prevents "host not found in upstream" at config load time
2. **`map_hash_bucket_size 512`** — JWT tokens (~300+ chars) exceed the default 128 bucket size
3. **Realtime container naming:** Supabase uses `realtime-dev.{tenant}-realtime` prefix, not `{tenant}-realtime`
4. **Health check on alpine:** Must use `127.0.0.1`, not `localhost` (IPv6 resolution issue)
5. **Windows Docker Desktop:** No `--network host` support → explicit port mappings via `NGINX_PORT_1-5`

---

## Overview

**Ziel:** Die per-Tenant Kong-Container (`{tenant}-kong`) eliminieren und deren Funktionalität in einen **einzigen Shared-Nginx-Container** (lokal) bzw. den **bestehenden System-Nginx** (Produktion) verlagern.

**Erwartete Einsparung:** ~1–1.7 GiB RAM **pro Tenant** (5 Kong-Instanzen = ~7 GiB aktuell).

---

## 1. IST-Zustand – Was Kong aktuell macht

### 1.1 Zwei Kong-Ebenen

| Ebene | Container | Port | Zweck |
|-------|-----------|------|-------|
| **Shared Kong** | `multibase-kong` | 8000 | Gateway für Shared Studio (dynamisch umkonfiguriert bei Tenant-Switch) |
| **Per-Tenant Kong** | `{tenant}-kong` | variabel (4928, 4351, 4681…) | API-Gateway pro Tenant für Client-Zugriffe |

### 1.2 Kong-Funktionen die ersetzt werden müssen

| Funktion | Plugin | Beschreibung | Schwierigkeit |
|----------|--------|--------------|---------------|
| **Path-Routing** | — (services/routes) | `/auth/v1/` → auth:9999, `/rest/v1/` → rest:3000, etc. | ✅ Trivial in Nginx |
| **Path-Stripping** | `strip_path: true` | `/auth/v1/verify` → `/verify` an Backend | ✅ Trivial in Nginx |
| **API-Key-Validierung** | `key-auth` | `apikey`-Header muss ANON_KEY oder SERVICE_ROLE_KEY entsprechen | ✅ Einfach (statischer String-Vergleich) |
| **ACL-Gruppen** | `acl` | Manche Routen nur `admin` (service_role), andere `anon`+`admin` | ✅ Einfach (Header-Check) |
| **CORS** | `cors` | Origins, Methods, Headers, Credentials | ✅ Standard Nginx |
| **WebSocket-Upgrade** | — | Realtime `/realtime/v1/` → ws://realtime:4000 | ✅ Standard Nginx |
| **Basic-Auth** | `basic-auth` | Dashboard-Zugang (nur Shared Kong) | ⚠️ Entfällt bei Tenant-Kong |
| **Request-Transform** | `request-transformer` | GraphQL: `Content-Profile: graphql_public` Header | ✅ `proxy_set_header` |

**Kernaussage:** Kong macht hier **nichts**, was Nginx nicht kann. Die `key-auth`-Validierung ist nur ein **statischer String-Vergleich** (kein JWT-Decoding) – der `apikey`-Header wird gegen die bekannten Keys verglichen.

### 1.3 Service-Routing-Tabelle (pro Tenant)

| Pfad | Backend-Service | Port | Auth benötigt | ACL |
|------|-----------------|------|---------------|-----|
| `/auth/v1/verify` | `{tenant}-auth` | 9999 | ❌ offen | — |
| `/auth/v1/callback` | `{tenant}-auth` | 9999 | ❌ offen | — |
| `/auth/v1/authorize` | `{tenant}-auth` | 9999 | ❌ offen | — |
| `/auth/v1/` | `{tenant}-auth` | 9999 | ✅ key-auth | anon+admin |
| `/auth/v1/admin` | `{tenant}-auth` | 9999 | ✅ key-auth | admin only |
| `/rest/v1/` | `{tenant}-rest` | 3000 | ✅ key-auth | anon+admin |
| `/graphql/v1` | `{tenant}-rest` | 3000 | ✅ key-auth | anon+admin |
| `/realtime/v1/` | `{tenant}-realtime` | 4000 | ✅ key-auth | anon+admin |
| `/storage/v1/` | `{tenant}-storage` | 5000 | ❌ offen | — |
| `/functions/v1/` | `{tenant}-edge-functions` | 9000 | ❌ offen | — |
| `/pg/` | `multibase-meta-{tenant}` | 8080 | ✅ key-auth | admin only |
| `/analytics/v1/` | `multibase-analytics` | 4000 | ❌ offen | — |

---

## 2. Architektur-Entscheidung

### Option A: Shared Nginx Container (Docker) ✅ EMPFOHLEN

Ein einzelner Nginx-Container (`multibase-nginx-gateway`) im `multibase-shared`-Netzwerk ersetzt alle per-Tenant Kong-Container.

```
                    ┌──────────────────────────────────────┐
                    │        multibase-shared Netzwerk      │
                    │                                       │
  Clients ────►    │  ┌────────────────────────────┐       │
  Port 80/443      │  │  multibase-nginx-gateway   │       │
                    │  │  (1 Container, ~20 MB RAM) │       │
                    │  │                            │       │
                    │  │  /auth/v1  → tenant-auth   │       │
                    │  │  /rest/v1  → tenant-rest   │       │
                    │  │  /storage  → tenant-storage│       │
                    │  │  /realtime → tenant-realtime│      │
                    │  │  /functions→ tenant-funcs   │       │
                    │  │  /pg      → tenant-meta    │       │
                    │  └─────────────┬──────────────┘       │
                    │                │                       │
                    │    ┌───────────┼──────────────┐       │
                    │    ▼           ▼              ▼       │
                    │  tenant-auth  tenant-rest  tenant-*   │
                    │  multibase-db (shared)                │
                    └──────────────────────────────────────┘
```

**Vorteile:**
- ~20 MB RAM statt ~1.7 GiB pro Kong-Instanz
- Dynamische Konfiguration per Template (wie bisher bei Kong)
- Funktioniert lokal auf Windows UND in Produktion
- Nginx kann als Reverse-Proxy direkt Docker-DNS nutzen (Container-Namen)

**Nachteile:**
- Neue Komponente (Nginx-Config-Generator statt KongConfigGenerator)
- Alle Tenants teilen sich einen Prozess (bei Fehlkonfiguration betroffen)

### Option B: System-Nginx direkt (nur Produktion)

Auf dem Linux-Server den bestehenden System-Nginx erweitern. Kein Docker-Container.

**Vorteil:** Kein zusätzlicher Container, bereits vorhanden.  
**Nachteil:** System-Nginx kann Container-Namen nicht auflösen → muss über `127.0.0.1:{port}` routen → braucht Port-Mappings pro Service.

### Empfehlung: Option A (Shared Nginx Container)

- Funktioniert überall gleich (Windows lokal + Linux Produktion)
- Kann Docker-DNS nutzen (keine Port-Mappings nötig)
- Nur 1 Container statt N Kong-Container
- In Produktion gibt System-Nginx an den Docker-Nginx weiter (wie bisher an Kong)

---

## 3. Implementierungsplan

### Phase 1: Nginx-Gateway Template erstellen

**Datei:** `templates/nginx/gateway.conf.template`

```nginx
# ============================================================
# Auto-generated Nginx gateway config for tenant: {{TENANT_NAME}}
# Replaces per-tenant Kong container
# Generated at: {{TIMESTAMP}}
# ============================================================

# --- API Key Validation ---
# Kong's key-auth Plugin als Nginx map:
# Prüft $http_apikey gegen bekannte Keys
map $http_apikey $apikey_valid {
    default         0;
    "{{ANON_KEY}}"          1;
    "{{SERVICE_ROLE_KEY}}"  1;
}

# ACL: Ist der Key ein Admin-Key (service_role)?
map $http_apikey $is_admin {
    default                 0;
    "{{SERVICE_ROLE_KEY}}"  1;
}

# --- CORS Konfiguration ---
map $http_origin $cors_origin {
    default "*";
}

server {
    listen 8000;
    server_name _;
    client_max_body_size 100M;

    # Standard CORS Headers für alle Responses
    set $cors_methods "GET, POST, PUT, PATCH, DELETE, OPTIONS";
    set $cors_headers "Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile, prefer, Range, Origin, Referer, Access-Control-Request-Headers, Access-Control-Request-Method";
    set $cors_exposed "Content-Length, Content-Range, accept-ranges, Content-Type, Content-Profile, Range-Unit";

    # ===== CORS Preflight Handler =====
    # Wird als named location von allen Routen genutzt
    location @cors_preflight {
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Methods' $cors_methods always;
        add_header 'Access-Control-Allow-Headers' $cors_headers always;
        add_header 'Access-Control-Max-Age' 3600 always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Content-Type' 'text/plain charset=UTF-8';
        add_header 'Content-Length' 0;
        return 204;
    }

    # ===== Open Auth Routes (kein API Key nötig) =====
    location = /auth/v1/verify {
        if ($request_method = 'OPTIONS') { return 204; }
        # CORS headers
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        proxy_pass http://{{TENANT_NAME}}-auth:9999/verify;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /auth/v1/callback {
        if ($request_method = 'OPTIONS') { return 204; }
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        proxy_pass http://{{TENANT_NAME}}-auth:9999/callback;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /auth/v1/authorize {
        if ($request_method = 'OPTIONS') { return 204; }
        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        proxy_pass http://{{TENANT_NAME}}-auth:9999/authorize;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== Secure Auth Admin (nur service_role / admin) =====
    location /auth/v1/admin {
        if ($request_method = 'OPTIONS') { return 204; }
        # Admin-only Route: nur service_role Key erlaubt
        if ($is_admin = 0) { return 401 '{"message":"No API key found in request","hint":"apikey header required with service_role key"}'; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        # strip /auth/v1 prefix → Backend bekommt /admin/*
        rewrite ^/auth/v1/(.*)$ /$1 break;
        proxy_pass http://{{TENANT_NAME}}-auth:9999;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== Secure Auth Routes (anon + admin) =====
    location /auth/v1/ {
        if ($request_method = 'OPTIONS') { return 204; }
        # API Key Validierung (anon ODER service_role)
        if ($apikey_valid = 0) { return 401 '{"message":"No API key found in request"}'; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        # strip /auth/v1 → Backend bekommt /*
        rewrite ^/auth/v1/(.*)$ /$1 break;
        proxy_pass http://{{TENANT_NAME}}-auth:9999;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== REST API (anon + admin) =====
    location /rest/v1/ {
        if ($request_method = 'OPTIONS') { return 204; }
        if ($apikey_valid = 0) { return 401 '{"message":"No API key found in request"}'; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        # hide_credentials: true → apikey Header nicht an Backend weitergeben
        proxy_set_header apikey "";
        rewrite ^/rest/v1/(.*)$ /$1 break;
        proxy_pass http://{{TENANT_NAME}}-rest:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== GraphQL (anon + admin) =====
    location /graphql/v1 {
        if ($request_method = 'OPTIONS') { return 204; }
        if ($apikey_valid = 0) { return 401 '{"message":"No API key found in request"}'; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        proxy_set_header apikey "";
        # request-transformer: Content-Profile Header hinzufügen
        proxy_set_header Content-Profile "graphql_public";
        proxy_pass http://{{TENANT_NAME}}-rest:3000/rpc/graphql;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== Realtime WebSocket (anon + admin) =====
    location /realtime/v1/ {
        if ($request_method = 'OPTIONS') { return 204; }
        if ($apikey_valid = 0) { return 401 '{"message":"No API key found in request"}'; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        rewrite ^/realtime/v1/(.*)$ /socket/$1 break;
        proxy_pass http://{{TENANT_NAME}}-realtime:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket Timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # ===== Realtime REST API =====
    location /realtime/v1/api {
        if ($request_method = 'OPTIONS') { return 204; }
        if ($apikey_valid = 0) { return 401 '{"message":"No API key found in request"}'; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        rewrite ^/realtime/v1/(.*)$ /$1 break;
        proxy_pass http://{{TENANT_NAME}}-realtime:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== Storage (offen – Storage validiert selbst) =====
    location /storage/v1/ {
        if ($request_method = 'OPTIONS') { return 204; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        rewrite ^/storage/v1/(.*)$ /$1 break;
        proxy_pass http://{{TENANT_NAME}}-storage:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== Edge Functions (offen) =====
    location /functions/v1/ {
        if ($request_method = 'OPTIONS') { return 204; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Expose-Headers' $cors_exposed always;

        rewrite ^/functions/v1/(.*)$ /$1 break;
        proxy_pass http://{{TENANT_NAME}}-edge-functions:9000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== Meta / pg (nur admin) =====
    location /pg/ {
        if ($request_method = 'OPTIONS') { return 204; }
        # Nur service_role Key erlaubt
        if ($is_admin = 0) { return 401 '{"message":"Unauthorized - admin only"}'; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        rewrite ^/pg/(.*)$ /$1 break;
        proxy_pass http://multibase-meta-{{TENANT_NAME}}:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== Analytics (offen) =====
    location /analytics/v1/ {
        if ($request_method = 'OPTIONS') { return 204; }

        add_header 'Access-Control-Allow-Origin' $cors_origin always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        rewrite ^/analytics/v1/(.*)$ /$1 break;
        proxy_pass http://multibase-analytics:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Phase 2: Nginx Config Generator (TypeScript)

**Datei:** `dashboard/backend/src/services/NginxGatewayGenerator.ts`

Ersetzt/ergänzt `KongConfigGenerator.ts`. Generiert dynamisch die Nginx-Config pro Tenant:

```typescript
// Pseudocode – Struktur
export interface NginxGatewayOptions {
  tenantName: string;
  anonKey: string;
  serviceRoleKey: string;
}

export function generateNginxGatewayConfig(options: NginxGatewayOptions): string {
  // 1. Template lesen (templates/nginx/gateway.conf.template)
  // 2. Platzhalter ersetzen:
  //    {{TENANT_NAME}} → options.tenantName
  //    {{ANON_KEY}} → options.anonKey
  //    {{SERVICE_ROLE_KEY}} → options.serviceRoleKey
  //    {{TIMESTAMP}} → new Date().toISOString()
  // 3. Zurückgeben
}

export async function writeNginxConfig(config: string, configDir: string): Promise<void> {
  // Schreibt nach shared/volumes/nginx/tenants/{tenant}.conf
}

export async function reloadNginxGateway(): Promise<void> {
  // docker exec multibase-nginx-gateway nginx -s reload
}
```

### Phase 3: Multi-Tenant Nginx (alle Tenants gleichzeitig)

**Wichtiger Unterschied zu Kong:** Kong verwendet pro Tenant einen eigenen Container mit eigenem Port. Der Shared Nginx kann **alle Tenants gleichzeitig** bedienen – über **verschiedene `server_name`** oder **verschiedene Ports**:

#### Variante A: Port-basiert (wie aktuell, einfachste Migration)
```nginx
# Jeder Tenant bekommt einen eigenen Port (wie Kong vorher)
# cloud-test → Port 4928
# cloud-test-2 → Port 4351
server {
    listen 4928;  # cloud-test
    # ... Routing zu cloud-test-* Containern
}
server {
    listen 4351;  # cloud-test-2
    # ... Routing zu cloud-test-2-* Containern
}
```

#### Variante B: Host-basiert (Produktion, zukunftssicher)
```nginx
# Produktion: über Subdomains
server {
    server_name cloud-test-api.backend.tyto-design.de;
    # ... Routing zu cloud-test-* Containern
}
server {
    server_name cloud-test-2-api.backend.tyto-design.de;
    # ... Routing zu cloud-test-2-* Containern
}
```

**Empfehlung:** Variante A für lokales Testing, Variante B für Produktion. Die Nginx-Config enthält beide.

### Phase 4: Docker-Compose Änderungen

#### 4.1 Neuer Shared Nginx Gateway Container

**Datei:** `shared/docker-compose.shared.yml` – neuer Service:

```yaml
  nginx-gateway:
    container_name: multibase-nginx-gateway
    image: nginx:alpine          # ~20 MB statt ~1.7 GiB (Kong)
    restart: unless-stopped
    ports:
      # Dynamisch: Ports aller aktiven Tenants
      # Werden per docker-compose.override.yml oder dynamisch konfiguriert
      - "8000:8000"              # Shared (bisher multibase-kong)
    volumes:
      - ./volumes/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./volumes/nginx/tenants:/etc/nginx/conf.d/tenants:ro
    networks:
      - multibase-shared
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 10s
      timeout: 5s
      retries: 3
```

#### 4.2 Per-Tenant Docker-Compose: Kong entfernen

**Änderung in** `supabase_setup.py` und `InstanceManager.ts`:

```diff
  # Pro Tenant nur noch 5 Container statt 6:
- services: kong, auth, rest, realtime, storage, edge-functions
+ services: auth, rest, realtime, storage, edge-functions
```

Kong-Port-Mapping entfällt. Stattdessen wird in der Nginx-Config ein `listen`-Port pro Tenant definiert.

#### 4.3 Dynamische Port-Zuordnung

Der `NginxGatewayGenerator` schreibt pro Tenant eine Config-Datei:
```
shared/volumes/nginx/tenants/cloud-test.conf     → listen 4928
shared/volumes/nginx/tenants/cloud-test-2.conf   → listen 4351
shared/volumes/nginx/tenants/cloud-test-3.conf   → listen 4681
```

Nach dem Schreiben: `docker exec multibase-nginx-gateway nginx -s reload` (~50ms, kein Downtime).

**Port-Bindung:** Da Nginx dynamisch Ports annehmen muss, gibt es zwei Optionen:
1. `--network host` (Linux) – Nginx bindet direkt an Host-Ports
2. Dynamisches Port-Mapping über Docker API / docker-compose override

---

### Phase 5: Code-Änderungen im Backend

#### 5.1 Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `KongConfigGenerator.ts` | → Wird zu `NginxGatewayGenerator.ts` (oder Wrapper) |
| `StudioManager.ts` | `ensureTenantKongMetaRoute()` → `ensureTenantNginxRoute()`, `reloadTenantKong()` → `reloadNginxGateway()`, `SUPABASE_URL` env → Nginx statt Kong |
| `InstanceManager.ts` | `createKongConfig()` → `createNginxConfig()`, Kong aus docker-compose entfernen |
| `supabase_setup.py` | Kong-Service aus Template entfernen, Nginx-Config generieren stattdessen |
| `envParser.ts` | `kong_http` / `kong_https` → `gateway_port` |
| `portManager.ts` | Nur noch 1 Port statt 2 (kein HTTPS auf Container-Ebene) |
| `types/index.ts` | `kong_http`/`kong_https` → `gateway_port` |
| `shared.ts` (routes) | `kong`-Port-Referenz aktualisieren |
| Nginx-Configs (`nginx/sites-enabled/`) | `proxy_pass http://127.0.0.1:{kong_port}` → `proxy_pass http://127.0.0.1:{gateway_port}` (gleich, nur anderer Container dahinter) |

#### 5.2 StudioManager Changes (Beispiel)

```typescript
// VORHER (StudioManager.ts Zeile 240)
`-e SUPABASE_URL=http://${tenantName}-kong:8000`,

// NACHHER
`-e SUPABASE_URL=http://multibase-nginx-gateway:${gatewayPort}`,
```

```typescript
// VORHER (ensureTenantKongMetaRoute)
private async ensureTenantKongMetaRoute(tenantName) {
  // Modifiziert kong.yml → docker exec {tenant}-kong kong reload
}

// NACHHER (ensureTenantNginxRoute)
private async ensureTenantNginxRoute(tenantName) {
  // Schreibt shared/volumes/nginx/tenants/{tenant}.conf
  // docker exec multibase-nginx-gateway nginx -s reload
}
```

---

## 4. Produktiv-Umgebung: Ist sie bereit?

### Aktuelle Situation (Linux/Nginx)

| Aspekt | Status | Details |
|--------|--------|---------|
| System-Nginx vorhanden | ✅ Ja | Configs in `nginx/sites-enabled/` |
| Per-Tenant API-Configs | ✅ Ja | `cloud-test-2.conf` etc. mit Subdomain-Routing |
| Auth-Subrequest | ✅ Ja | `auth_request /auth-check` → Dashboard Backend |
| WebSocket-Support | ✅ Ja | `proxy_set_header Upgrade/Connection` |
| CORS | ❌ Fehlt | Aktuell macht Kong CORS, nicht Nginx |
| API Key Validierung | ❌ Fehlt | Aktuell macht Kong key-auth |
| Path-Stripping | ❌ Fehlt | Aktuell macht Kong strip_path |
| Multi-Service Routing | ❌ Fehlt | Aktuell routet Nginx pauschal an Kong Port |

### Was in Produktion geändert werden muss

**Aktuell:**
```
Client → System-Nginx (cloud-test-2-api.backend.tyto-design.de)
       → proxy_pass http://127.0.0.1:4351  (= cloud-test-2-kong:8000)
       → Kong routet intern zu auth/rest/storage/...
```

**Nachher:**
```
Client → System-Nginx (cloud-test-2-api.backend.tyto-design.de)
       → proxy_pass http://127.0.0.1:4351  (= multibase-nginx-gateway:4351)
       → Nginx-Gateway routet intern zu auth/rest/storage/...
```

**Für den System-Nginx ändert sich fast nichts** – er zeigt weiterhin auf denselben Port. Nur dahinter steht jetzt Nginx statt Kong. Die API-Key-Validierung und das Path-Routing passieren im Gateway-Container.

**Die Produktiv-Umgebung ist somit mit minimalen Änderungen bereit!**

---

## 5. Lokales Testing auf Windows

### Schritt-für-Schritt Testplan

#### 5.1 Nginx Gateway Container starten

```powershell
# 1. Verzeichnisstruktur anlegen
mkdir -p shared/volumes/nginx/tenants

# 2. Haupt-nginx.conf erstellen
# (siehe templates/nginx/nginx.conf)

# 3. Gateway Container starten  
docker run -d `
  --name multibase-nginx-gateway `
  --network multibase-shared `
  -p 4928:4928 `
  -v "${PWD}/shared/volumes/nginx/nginx.conf:/etc/nginx/nginx.conf:ro" `
  -v "${PWD}/shared/volumes/nginx/tenants:/etc/nginx/conf.d/tenants:ro" `
  nginx:alpine
```

#### 5.2 Tenant-Config generieren und testen

```powershell
# 1. Config für cloud-test generieren (Template-Platzhalter ersetzen)
# → shared/volumes/nginx/tenants/cloud-test.conf

# 2. Nginx reload
docker exec multibase-nginx-gateway nginx -s reload

# 3. Testen – alle Endpunkte die bisher über Kong liefen:

# Health Check (auth)
curl http://localhost:4928/auth/v1/health

# REST API mit API Key
curl -H "apikey: <ANON_KEY>" http://localhost:4928/rest/v1/

# Storage (offen)
curl http://localhost:4928/storage/v1/bucket

# Meta (nur service_role)
curl -H "apikey: <SERVICE_ROLE_KEY>" http://localhost:4928/pg/health

# WebSocket Realtime
wscat -c "ws://localhost:4928/realtime/v1/websocket?apikey=<ANON_KEY>"
```

#### 5.3 Vergleichstest Kong vs. Nginx

```powershell
# Beide parallel laufen lassen:
# Kong auf Port 4928 (bestehend)
# Nginx auf Port 14928 (Test)

# Dann dieselben Requests an beide schicken und Responses vergleichen:
$endpoints = @(
    "/auth/v1/health",
    "/rest/v1/",
    "/storage/v1/bucket",
    "/pg/health",
    "/analytics/v1/"
)

foreach ($ep in $endpoints) {
    $kongResult = Invoke-RestMethod "http://localhost:4928$ep" -Headers @{apikey="<ANON_KEY>"}
    $nginxResult = Invoke-RestMethod "http://localhost:14928$ep" -Headers @{apikey="<ANON_KEY>"}
    Compare-Object $kongResult $nginxResult
}
```

#### 5.4 Studio-Integration testen

```powershell
# 1. Tenant in Studio aktivieren
# 2. Prüfen ob Studio über Nginx-Gateway korrekt funktioniert:
#    - SQL Editor → /pg/ Route
#    - Auth Users → /auth/v1/admin Route
#    - Storage → /storage/v1/ Route
#    - Edge Functions → /functions/v1/ Route
```

---

## 6. Migrations-Strategie (Zero-Downtime)

### Phase A: Parallel betreiben (1 Woche)
1. Nginx-Gateway Container deployen
2. Configs für alle Tenants generieren
3. Kong läuft weiter, Nginx auf Test-Ports
4. Automatisierte Tests gegen beide

### Phase B: Kong-Traffic umleiten
1. System-Nginx zeigt auf Nginx-Gateway statt Kong
2. Kong läuft noch als Fallback
3. Monitoring für 48h

### Phase C: Kong entfernen
1. Kong-Container stoppen
2. docker-compose Files bereinigen
3. Kong-Code entfernen / deprecated markieren
4. RAM-Einsparung verifizieren

---

## 7. Risiken & Mitigationen

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|---------------------|------------|
| Nginx `if` ist "evil" (bekanntes Nginx-Thema) | Mittel | `map`-Direktiven + error_page statt `if` wo möglich |
| Port-Bindung bei dynamischen Tenants | Mittel | `--network host` oder Docker port publish API |
| CORS-Unterschiede zwischen Kong und Nginx | Niedrig | Vergleichstests in Phase A |
| Realtime WebSocket-Handshake Fehler | Niedrig | Dedizierter Location-Block mit upgrade Headers |
| `hide_credentials` Verhalten | Niedrig | `proxy_set_header apikey ""` in Nginx |

---

## 8. Dateien die erstellt/geändert werden

### Neue Dateien
| Datei | Beschreibung |
|-------|-------------|
| `templates/nginx/gateway.conf.template` | Nginx Gateway Template pro Tenant |
| `templates/nginx/nginx.conf` | Haupt-nginx.conf für den Gateway Container |
| `dashboard/backend/src/services/NginxGatewayGenerator.ts` | Config Generator (ersetzt Kong Generator) |
| `shared/volumes/nginx/nginx.conf` | Generierte Haupt-Config (Runtime) |
| `shared/volumes/nginx/tenants/*.conf` | Generierte per-Tenant Configs (Runtime) |

### Geänderte Dateien
| Datei | Änderung |
|-------|----------|
| `shared/docker-compose.shared.yml` | + nginx-gateway Service, - kong Service (optional behalten) |
| `dashboard/backend/src/services/StudioManager.ts` | Kong-Referenzen → Nginx-Referenzen |
| `dashboard/backend/src/services/InstanceManager.ts` | Kong aus docker-compose entfernen |
| `supabase_setup.py` | Kong-Service entfernen, Nginx-Config generieren |
| `dashboard/backend/src/types/index.ts` | Port-Typen anpassen |
| `dashboard/backend/src/utils/envParser.ts` | Kong-Port → Gateway-Port |
| `dashboard/backend/src/utils/portManager.ts` | Nur 1 Port statt 2 |
| `nginx/sites-enabled/*.conf` (Produktion) | Kommentar: Port zeigt jetzt auf Nginx statt Kong |

---

## 9. Zusammenfassung

| Aspekt | Vorher (Kong) | Nachher (Nginx) |
|--------|---------------|-----------------|
| **Container pro Tenant** | 6 (inkl. Kong) | 5 (ohne Kong) |
| **RAM pro Tenant** | ~2.2 GiB | ~0.5 GiB (Kong-Anteil weg) |
| **Gateway RAM gesamt** | ~7 GiB (5× Kong) | ~20 MB (1× Nginx) |
| **Config Reload** | `kong reload` (~1s) | `nginx -s reload` (~50ms) |
| **Config Format** | YAML (deklarativ) | Nginx conf (Template) |
| **API Key Check** | key-auth Plugin | `map` + Header-Check |
| **CORS** | cors Plugin | `add_header` Direktiven |
| **WebSocket** | Automatisch | Explizit `upgrade` Header |
| **Produktiv-Impact** | Kong-Port erreichbar | Gleicher Port, Nginx dahinter |

**Geschätzte Einsparung: ~7 GiB RAM** bei aktuellem Setup (5 Kong-Instanzen → 1 Nginx).

---

## 10. Post-Migration Notes (for future developers)

### How nginx configs are generated

1. **On `setup_shared.py start`:** The `_regenerate_nginx_tenant_configs()` method iterates all `projects/*/` dirs, reads each `.env`, substitutes `templates/nginx/gateway.conf.template`, and writes to `shared/volumes/nginx/tenants/{tenant}.conf`. Then reloads nginx.
2. **On `supabase_setup.py` (new tenant creation):** The setup script generates the nginx config inline during project creation.
3. **From Dashboard Backend:** `NginxGatewayGenerator.ts` can generate and reload configs programmatically.

### Common operations

```bash
# Manually reload nginx after config change
docker exec multibase-nginx-gateway nginx -s reload

# Test nginx config validity
docker exec multibase-nginx-gateway nginx -t

# View current tenant configs
ls shared/volumes/nginx/tenants/

# Regenerate all tenant configs
python setup_shared.py start
```

### Backward compatibility

- `gateway_port` is the canonical field; `kong_http`/`kong_https` are kept as optional deprecated aliases
- `SHARED_GATEWAY_PORT` env var replaces `SHARED_KONG_HTTP_PORT` (fallback reads both)
- Existing `.env.shared` files from before the migration still work via fallback logic

[Back to Version Overview](./VERSION_OVERVIEW.md)
