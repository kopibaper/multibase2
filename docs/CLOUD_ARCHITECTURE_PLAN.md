# Multibase Cloud Architecture Plan

> **Ziel:** Supabase-Cloud-ähnliche Erfahrung mit voller Funktionalität (Auth, Storage, Edge Functions, RLS, SQL Editor) bei maximalem Resource-Sharing und strikter Datenisolierung.

---

## 1. Problemanalyse

### 1.1 Aktuelle Situation

**Shared Studio funktioniert nur teilweise.** Das zentrale Studio (`multibase-studio:3000`) verbindet sich über den Shared Kong (`multibase-kong:8000`), der aber nur 2 Routes hat:

| Route | Ziel | Funktion |
|-------|------|----------|
| `/pg` | `multibase-meta:8080` | SQL Editor, Table Editor ✅ |
| `/analytics/v1` | `multibase-analytics:4000` | Logs ✅ |

**Fehlende Routes im Shared Kong:**

| Route | Dienst | Studio-Feature |
|-------|--------|----------------|
| `/auth/v1` | `{tenant}-auth:9999` | Auth User Management ❌ |
| `/rest/v1` | `{tenant}-rest:3000` | API Docs, Table Data ❌ |
| `/storage/v1` | `{tenant}-storage:5000` | Storage Browser ❌ |
| `/functions/v1` | `{tenant}-edge-functions:9000` | Edge Functions UI ❌ |
| `/realtime/v1` | `{tenant}-realtime:4000` | Realtime Inspector ❌ |

### 1.2 pg-meta Problem

`multibase-meta` verbindet sich statisch zu `PG_META_DB_NAME=postgres`. Studio sieht daher die Tabellen/Schemas der **Default-DB**, nicht der Tenant-DBs (`project_cloud_test`, `project_cloud_test_2` etc.).

### 1.3 Kong RAM-Verbrauch (gemessen)

| Container | RAM |
|---|---|
| `multibase-kong` (Shared) | **1.642 GB** |
| `cloud-test-kong` | **1.638 GB** |
| `cloud-test-2-kong` | **1.660 GB** |
| `cloud-test-3-kong` | **1.015 GB** |
| **Summe 4× Kong** | **~5.9 GB (66% des Gesamt-RAM!)** |

Zum Vergleich: Alle 3 Auth-Container zusammen = **37 MB**.

---

## 2. Zielarchitektur

### 2.1 Design-Prinzipien

1. **Supabase-Cloud-Erfahrung:** Studio mit voller Funktionalität für jeden Tenant
2. **Resource-Sharing:** Geteilte Dienste wo sicher möglich
3. **Strikte Datenisolierung:** Jeder Tenant hat eigene DB, Auth, Storage
4. **Kein Quick-Fix:** Saubere, nachhaltige Architektur
5. **Performance:** Tenant-Wechsel < 5 Sekunden

### 2.2 Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                    Multibase Dashboard                       │
│                    (Port 5173 / 3001)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Tenant A │  │ Tenant B │  │ Tenant C │   ← Instanzkarten│
│  │ [Studio] │  │ [Studio] │  │ [Studio] │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
└───────┼──────────────┼──────────────┼───────────────────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │ POST /api/studio/activate/:tenant
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Shared Infrastructure                           │
│                                                              │
│  ┌────────────────────┐     ┌──────────────────┐            │
│  │   API Gateway       │     │    Studio         │            │
│  │   (nginx/Caddy)     │     │    (Port 3000)    │            │
│  │   Port 8000         │◄────│    SUPABASE_URL   │            │
│  │                     │     │    =:8000          │            │
│  │  /auth/v1  ──►active│     └──────────────────┘            │
│  │  /rest/v1  ──►tenant│                                     │
│  │  /storage/v1►routes │     ┌──────────────────┐            │
│  │  /functions ──►     │     │    pg-meta         │            │
│  │  /pg       ──►meta  │     │    DB=active_tenant│            │
│  │  /analytics──►logfl.│     │    (Restart ~2s)   │            │
│  └────────────────────┘     └──────────────────┘            │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐ │
│  │ Postgres │ │ Analytics│ │  Vector  │ │ imgproxy/Redis │ │
│  │ (shared) │ │ (shared) │ │ (shared) │ │    (shared)    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│   Tenant A   ││   Tenant B   ││   Tenant C   │
│              ││              ││              │
│ ┌──────────┐ ││ ┌──────────┐ ││ ┌──────────┐ │
│ │  nginx   │ ││ │  nginx   │ ││ │  nginx   │ │
│ │ Port 4928│ ││ │ Port 7744│ ││ │ Port 8811│ │
│ │ ~5 MB    │ ││ │ ~5 MB    │ ││ │ ~5 MB    │ │
│ └──────────┘ ││ └──────────┘ ││ └──────────┘ │
│ ┌──────────┐ ││ ┌──────────┐ ││ ┌──────────┐ │
│ │Auth 12MB │ ││ │Auth 12MB │ ││ │Auth 12MB │ │
│ │Rest 132MB│ ││ │Rest 132MB│ ││ │Rest 132MB│ │
│ │Store 62MB│ ││ │Store 62MB│ ││ │Store 62MB│ │
│ │RT   200MB│ ││ │RT   200MB│ ││ │RT   200MB│ │
│ │Func  24MB│ ││ │Func  24MB│ ││ │Func  24MB│ │
│ └──────────┘ ││ └──────────┘ ││ └──────────┘ │
│  ~435 MB     ││  ~435 MB     ││  ~435 MB     │
└──────────────┘└──────────────┘└──────────────┘
```

### 2.3 RAM-Vergleich

| | Aktuell (3 Tenants) | Ziel (3 Tenants) | Einsparung |
|---|---|---|---|
| Shared Kong | 1.642 GB | ~10 MB (nginx) | **-1.63 GB** |
| 3× Tenant Kong | 4.313 GB | ~15 MB (3×nginx) | **-4.30 GB** |
| Shared Stack (Rest) | 1.884 GB | 1.884 GB | 0 |
| 3× Tenant Services | 1.384 GB | 1.290 GB | -94 MB |
| **Gesamt** | **~9.2 GB** | **~3.2 GB** | **-6.0 GB (65%)** |

Bei 10 Tenants:

| | Aktuell | Ziel | Einsparung |
|---|---|---|---|
| **Gesamt** | ~20.5 GB | ~5.8 GB | **-14.7 GB (72%)** |

---

## 3. Implementierungsplan

### Phase 1: Studio-Tenant-Switching (Volle Funktionalität)

**Ziel:** Studio kann alle Features für jeden Tenant nutzen (Auth, Storage, Functions, SQL, RLS).

**Kein** Studio-Restart nötig. Nur Backend-Routing wird umgeschaltet.

#### 1.1 Backend API: Tenant-Aktivierung

Neuer Endpoint im Dashboard-Backend:

```
POST /api/studio/activate/:tenantName
```

**Was passiert beim Aufruf:**

1. **Shared Kong-Config regenerieren** → Routes zeigen auf aktiven Tenant
2. **Kong Config Reload** → `docker exec multibase-kong kong reload` (~1s, kein Neustart)
3. **pg-meta Neustart** → `PG_META_DB_NAME=project_{tenant}` (~2s)
4. **Response** → `{ active_tenant: "cloud-test", studio_url: "http://localhost:3000" }`

**Dateien zu erstellen/ändern:**

| Datei | Aktion |
|---|---|
| `dashboard/backend/src/routes/studio.ts` | **Neu** - Studio-Aktivierungs-Route |
| `dashboard/backend/src/services/StudioManager.ts` | **Neu** - Tenant-Switching-Logik |
| `dashboard/backend/src/services/KongConfigGenerator.ts` | **Neu** - Dynamische Kong-Config |
| `shared/docker-compose.shared.yml` | **Ändern** - Kong entrypoint für Config-Reload |
| `shared/volumes/api/kong.yml` | Wird **dynamisch generiert** (nicht mehr statisch) |

#### 1.2 Dynamische Shared-Kong-Konfiguration

Template-basierte Generierung der `kong.yml` mit allen Routes für den aktiven Tenant:

```yaml
# Dynamisch generiert für aktiven Tenant: {TENANT_NAME}
services:
  # === Tenant-spezifische Routes ===
  - name: auth-v1
    url: http://{TENANT_NAME}-auth:9999/verify
    routes:
      - name: auth-v1-route
        paths: [/auth/v1/verify]
    plugins: [{cors_plugin}]

  - name: auth-v1-api
    url: http://{TENANT_NAME}-auth:9999
    routes:
      - name: auth-v1-api-route
        paths: [/auth/v1]
    plugins: [{cors_plugin}]

  - name: auth-v1-admin
    url: http://{TENANT_NAME}-auth:9999/admin
    routes:
      - name: auth-v1-admin-route
        paths: [/auth/v1/admin]
    plugins: [{cors_plugin}, {key_auth}, {acl_admin}]

  - name: rest
    url: http://{TENANT_NAME}-rest:3000
    routes:
      - name: rest-route
        paths: [/rest/v1]
    plugins: [{cors_plugin}]

  - name: storage
    url: http://{TENANT_NAME}-storage:5000
    routes:
      - name: storage-route
        paths: [/storage/v1]
    plugins: [{cors_plugin}]

  - name: realtime
    url: http://{TENANT_NAME}-realtime:4000/socket/
    routes:
      - name: realtime-route
        paths: [/realtime/v1]
    plugins: [{cors_plugin}]

  - name: functions
    url: http://{TENANT_NAME}-edge-functions:9000
    routes:
      - name: functions-route
        paths: [/functions/v1]
    plugins: [{cors_plugin}]

  # === Shared Routes (immer gleich) ===
  - name: meta
    url: http://multibase-meta:8080
    routes:
      - name: meta-route
        paths: [/pg]
    plugins: [{cors_plugin}, {key_auth}, {acl_admin}]

  - name: analytics
    url: http://multibase-analytics:4000
    routes:
      - name: analytics-route
        paths: [/analytics/v1]
    plugins: [{cors_plugin}]
```

**Wichtig:** Alle Tenant-Container sind bereits im `multibase-shared` Netzwerk. Ko Netzwerk-Änderungen nötig!

#### 1.3 pg-meta Dynamic DB Switching

```typescript
// StudioManager.ts
async switchPgMeta(tenantName: string, projectDb: string): Promise<void> {
  // 1. Container stoppen
  await docker.stopContainer('multibase-meta');

  // 2. Env-Variable ändern (docker-compose override oder direkt)
  await this.updateMetaDbName(projectDb);

  // 3. Container neu starten
  await docker.startContainer('multibase-meta');
  // ~2 Sekunden für Neustart
}
```

**Alternative (eleganter):** Docker Compose Environment-Override:
```bash
docker compose -f shared/docker-compose.shared.yml up -d meta \
  -e PG_META_DB_NAME=project_cloud_test
```

#### 1.4 Frontend: Studio-Button mit Tenant-Switch

```tsx
// InstanceCard.tsx - Neuer Studio-Button
const handleOpenStudio = async () => {
  setLoading(true);
  try {
    // 1. Tenant aktivieren (Backend switched Kong + pg-meta)
    await fetch(`/api/studio/activate/${instance.name}`, { method: 'POST' });
    // 2. Studio öffnen (immer Port 3000)
    window.open(`http://${window.location.hostname}:3000`, '_blank');
  } finally {
    setLoading(false);
  }
};
```

#### 1.5 Voraussetzungen (bereits erfüllt ✅)

- [x] Alle Tenant-Container im `multibase-shared` Netzwerk
- [x] Gleicher `JWT_SECRET` für alle (Shared + Tenants)
- [x] Gleiche `ANON_KEY` / `SERVICE_ROLE_KEY` für alle
- [x] Studio läuft dauerhaft auf Port 3000
- [x] Studio zeigt auf `SUPABASE_URL: http://multibase-kong:8000`

---

### Phase 2: Kong → nginx Replacement (Resource-Optimierung)

**Ziel:** ~6 GB RAM-Einsparung durch Ersetzen aller Kong-Instanzen mit nginx.

**Warum das funktioniert:**
- Kong-Plugins (key-auth, ACL) sind für unser Setup **redundant** - die Supabase-Services (PostgREST, GoTrue, Storage) validieren JWTs selbst
- Kong wird nur als Reverse-Proxy genutzt → nginx kann das genauso, mit ~5 MB statt ~1.6 GB
- CORS kann nginx nativ

#### 2.1 Shared API Gateway: Kong → nginx

**Neue Datei:** `shared/volumes/api/nginx.conf.template`

```nginx
# Dynamisch generiert für aktiven Tenant: ${TENANT_NAME}

upstream auth_backend {
    server ${TENANT_NAME}-auth:9999;
}
upstream rest_backend {
    server ${TENANT_NAME}-rest:3000;
}
upstream storage_backend {
    server ${TENANT_NAME}-storage:5000;
}
upstream realtime_backend {
    server ${TENANT_NAME}-realtime:4000;
}
upstream functions_backend {
    server ${TENANT_NAME}-edge-functions:9000;
}

server {
    listen 8000;

    # CORS Headers für alle Locations
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Accept, Authorization, Content-Type, apikey, x-client-info' always;

    # Auth
    location /auth/v1/ {
        proxy_pass http://auth_backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # REST API (PostgREST)
    location /rest/v1/ {
        proxy_pass http://rest_backend/;
        proxy_set_header Host $host;
    }

    # Storage
    location /storage/v1/ {
        proxy_pass http://storage_backend/;
        proxy_set_header Host $host;
        client_max_body_size 50M;
    }

    # Realtime (WebSocket)
    location /realtime/v1/ {
        proxy_pass http://realtime_backend/socket/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Edge Functions
    location /functions/v1/ {
        proxy_pass http://functions_backend/;
        proxy_set_header Host $host;
    }

    # pg-meta (für Studio)
    location /pg/ {
        proxy_pass http://multibase-meta:8080/;
        proxy_set_header Host $host;
    }

    # Analytics (für Studio Logs)
    location /analytics/v1/ {
        proxy_pass http://multibase-analytics:4000/;
        proxy_set_header Host $host;
    }
}
```

#### 2.2 Per-Tenant Gateway: Kong → nginx

Jeder Tenant bekommt eine leichtgewichtige nginx-Instanz statt Kong:

**Template:** `templates/cloud/nginx.conf.template`

```nginx
# Auto-generated for tenant: ${TENANT_NAME}
server {
    listen 8000;

    location /auth/v1/ {
        proxy_pass http://${TENANT_NAME}-auth:9999/;
    }

    location /rest/v1/ {
        proxy_pass http://${TENANT_NAME}-rest:3000/;
    }

    location /storage/v1/ {
        proxy_pass http://${TENANT_NAME}-storage:5000/;
        client_max_body_size 50M;
    }

    location /realtime/v1/ {
        proxy_pass http://${TENANT_NAME}-realtime:4000/socket/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /functions/v1/ {
        proxy_pass http://${TENANT_NAME}-edge-functions:9000/;
    }
}
```

**Docker Compose Änderung (Tenant):**

```yaml
# VORHER (Kong ~1.6 GB RAM):
kong:
  image: kong:2.8.1
  # ...

# NACHHER (nginx ~5 MB RAM):
gateway:
  container_name: ${TENANT_NAME}-gateway
  image: nginx:alpine
  restart: unless-stopped
  ports:
    - "${KONG_HTTP_PORT}:8000/tcp"
  volumes:
    - ./volumes/api/nginx.conf:/etc/nginx/conf.d/default.conf:ro
  networks:
    - multibase-shared
    - default
```

#### 2.3 Supabase JS Client Kompatibilität

Supabase JS Client sendet `apikey` Header. PostgREST/GoTrue/Storage validieren JWT selbst:

| Service | JWT-Validierung | apikey-Header benötigt? |
|---------|----------------|------------------------|
| PostgREST | ✅ `PGRST_JWT_SECRET` | Nein (JWT in `Authorization`) |
| GoTrue | ✅ Eigene Auth-Logik | Nein |
| Storage | ✅ `PGRST_JWT_SECRET` | Nein |
| Realtime | ✅ `API_JWT_SECRET` | Nein |
| Edge Functions | ✅ `JWT_SECRET` | Nein |

**Fazit:** Kong's key-auth/ACL Plugins sind für die API-Communication nicht notwendig. Die Services validieren JWTs eigenständig. nginx als reiner Reverse-Proxy reicht aus.

> **Anmerkung:** Falls ein Service den `apikey` Header erwartet, kann nginx diesen via `proxy_set_header` statisch setzen.

#### 2.4 Migration per Tenant

Für jeden bestehenden Tenant:

1. `docker compose -f projects/{tenant}/docker-compose.yml down kong`
2. `generate_nginx_config({tenant})` → `projects/{tenant}/volumes/api/nginx.conf`
3. Aktualisiere `docker-compose.yml`: Kong-Service → nginx-Service
4. `docker compose -f projects/{tenant}/docker-compose.yml up -d gateway`

**Rollback:** Falls Probleme: Kong-Image in docker-compose zurücksetzen, `up -d`.

---

### Phase 3: Erweiterte Optimierungen (Optional)

#### 3.1 Analytics Memory-Limit

```yaml
# Aktuell: ~1 GB RAM für Logflare
analytics:
  deploy:
    resources:
      limits:
        memory: 512M  # Reduziert von 1G auf 512M
      reservations:
        memory: 256M  # Reduziert von 512M auf 256M
```

#### 3.2 Pooler (Supavisor) Tuning

Aktuell 256 MB. Parameter optimieren:

```yaml
POOLER_DEFAULT_POOL_SIZE: 20    # Reduziert von 50
POOLER_MAX_CLIENT_CONN: 200     # Reduziert von 500
```

#### 3.3 Lazy-Loading von Tenant-Services

Konzept: Inaktive Tenants stoppen, bei Bedarf starten.

```
Tenant inaktiv (>30 min kein Request):
  → Auth, Rest, Storage, Functions, Realtime GESTOPPT
  → Spart ~430 MB pro inaktiven Tenant

Tenant wird angefragt (API Request über nginx):
  → nginx proxy_pass schlägt fehl (502)
  → Error-Page triggert Activation-Webhook
  → Backend startet Tenant-Services (~10s)
  → Request wird retried
```

**Einsparung bei 10 Tenants, 3 aktiv:** ~7 × 430 MB = **~3 GB** zusätzlich gespart.

---

## 4. Implementierungs-Reihenfolge

```
Phase 1: Studio Multi-Tenant        ┌─────────────────────┐
  1.1 StudioManager Service          │ Woche 1             │
  1.2 KongConfigGenerator            │                     │
  1.3 API Route /studio/activate     │                     │
  1.4 pg-meta Dynamic Switch         │                     │
  1.5 Frontend Studio-Button         │                     │
  1.6 Testing & Debug                └─────────────────────┘

Phase 2: Kong → nginx               ┌─────────────────────┐
  2.1 nginx Config Template          │ Woche 2             │
  2.2 Shared Kong → nginx            │                     │
  2.3 Per-Tenant Kong → nginx        │                     │
  2.4 supabase_setup.py anpassen     │                     │
  2.5 InstanceManager anpassen       │                     │
  2.6 Testing & Rollback-Plan        └─────────────────────┘

Phase 3: Optimierungen              ┌─────────────────────┐
  3.1 Analytics Memory-Limit         │ Woche 3 (optional)  │
  3.2 Pooler Tuning                  │                     │
  3.3 Lazy-Loading Konzept           │                     │
  3.4 Monitoring Dashboard           └─────────────────────┘
```

---

## 5. Detaillierte Änderungsliste

### Phase 1 - Neue Dateien

| Datei | Beschreibung |
|---|---|
| `dashboard/backend/src/routes/studio.ts` | Express Router für Studio-Aktivierung |
| `dashboard/backend/src/services/StudioManager.ts` | Tenant-Switch Logik (Kong reload, pg-meta restart) |
| `dashboard/backend/src/services/KongConfigGenerator.ts` | Generiert kong.yml dynamisch für aktiven Tenant |
| `shared/volumes/api/kong.yml.template` | Template für dynamische Kong-Config |

### Phase 1 - Zu ändernde Dateien

| Datei | Änderung |
|---|---|
| `dashboard/backend/src/server.ts` | Studio-Route registrieren |
| `dashboard/backend/src/routes/shared.ts` | Active-Tenant-Status zurückgeben |
| `dashboard/frontend/src/components/InstanceCard.tsx` | Studio-Button mit Tenant-Activation |
| `shared/docker-compose.shared.yml` | Kong Volume Mount writable (für Config-Reload) |

### Phase 2 - Neue Dateien

| Datei | Beschreibung |
|---|---|
| `templates/cloud/nginx.conf.template` | nginx Template für Per-Tenant Gateway |
| `shared/volumes/api/nginx.conf.template` | nginx Template für Shared Gateway |
| `dashboard/backend/src/services/NginxConfigGenerator.ts` | Generiert nginx.conf für Tenants |

### Phase 2 - Zu ändernde Dateien

| Datei | Änderung |
|---|---|
| `shared/docker-compose.shared.yml` | Kong → nginx Service |
| `templates/cloud/docker-compose.yml` (falls vorhanden) | Kong → nginx |
| `supabase_setup.py` | nginx statt Kong im Tenant-Stack |
| `dashboard/backend/src/services/InstanceManager.ts` | Kong-Referenzen → nginx |
| `dashboard/backend/src/types/index.ts` | Service-Types anpassen |

---

## 6. Risiken & Mitigierung

| Risiko | Wahrscheinlichkeit | Mitigierung |
|---|---|---|
| Kong-Plugins werden doch gebraucht | Niedrig | Services validieren JWTs selbst. Fallback: Kong behalten |
| pg-meta Restart zu langsam | Niedrig | Gemessen ~2s. Alternative: pg-meta per Tenant (~30 MB) |
| Studio cached alten Tenant | Mittel | Frontend: Force-Reload bei Tenant-Switch |
| nginx WebSocket Kompatibilität | Niedrig | Gut dokumentiert, Standard-Config |
| Concurrent Studio Users | Mittel | Lock-Mechanismus: nur 1 aktiver Tenant für Studio |

---

## 7. Testing-Checkliste

### Phase 1 Smoke Tests:
- [ ] `POST /api/studio/activate/cloud-test` → 200 OK
- [ ] Studio öffnen → Auth User Management funktioniert
- [ ] Studio öffnen → Storage Browser funktioniert
- [ ] Studio öffnen → Table Editor zeigt Tenant-Tabellen
- [ ] Studio öffnen → SQL Editor auf Tenant-DB
- [ ] Studio öffnen → RLS Policies sichtbar/editierbar
- [ ] Studio öffnen → Edge Functions sichtbar
- [ ] Tenant wechseln → Studio zeigt andere Daten
- [ ] Supabase JS Client → API-Zugriff funktioniert weiterhin

### Phase 2 Smoke Tests:
- [ ] nginx Shared Gateway erreichbar auf Port 8000
- [ ] nginx Per-Tenant erreichbar auf Tenant-Port
- [ ] Supabase JS Client `createClient()` funktioniert
- [ ] Auth SignUp / SignIn via nginx
- [ ] Storage Upload / Download via nginx
- [ ] Realtime Subscriptions via nginx (WebSocket)
- [ ] Edge Functions Invocation via nginx
- [ ] Studio weiterhin voll funktionsfähig
- [ ] RAM-Verbrauch um ~65% reduziert

---

## 8. Zusammenfassung

| Metrik | Aktuell | Nach Phase 1 | Nach Phase 2 |
|---|---|---|---|
| Studio-Funktionalität | ~30% (nur SQL) | **100%** | 100% |
| RAM (3 Tenants) | ~9.2 GB | ~9.2 GB | **~3.2 GB** |
| RAM (10 Tenants) | ~20.5 GB | ~20.5 GB | **~5.8 GB** |
| RAM pro neuer Tenant | ~1.8 GB | ~1.8 GB | **~435 MB** |
| Tenant-Wechsel Studio | Nicht möglich | **~3-5 Sek** | ~3-5 Sek |
| Per-Tenant Container | 6 | 6 | 6 (nginx statt Kong) |

**Phase 1 löst das Funktionalitätsproblem. Phase 2 löst das Ressourcenproblem.**
