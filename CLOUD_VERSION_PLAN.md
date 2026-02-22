# Multibase Cloud Version – Architektur-Plan

## Branch-Strategie

| Branch | Zweck | Deployment |
|---|---|---|
| `main` | **Produktion/Stable** – Aktueller Stand bleibt erhalten | Server (VPS) zum Testen mit Domain + Linux |
| `cloud-version` | **Cloud-Architektur** – Massive Umstrukturierung | Lokal (Windows/Docker Desktop) + später Server |

> `main` wird **nie** von `cloud-version` überschrieben. Beide Branches existieren parallel.
> Wenn Cloud-Version stabil ist, kann ein kontrollierter Merge oder separates Deployment erfolgen.

---

## Das Problem: Aktuelle Architektur

### Ist-Zustand: "1 Projekt = 13 Container"

```
Projekt A (13 Container)          Projekt B (13 Container)          Projekt C (13 Container)
┌─────────────────────┐           ┌─────────────────────┐           ┌─────────────────────┐
│ studio              │           │ studio              │           │ studio              │
│ kong                │           │ kong                │           │ kong                │
│ auth (GoTrue)       │           │ auth (GoTrue)       │           │ auth (GoTrue)       │
│ rest (PostgREST)    │           │ rest (PostgREST)    │           │ rest (PostgREST)    │
│ realtime            │           │ realtime            │           │ realtime            │
│ storage             │           │ storage             │           │ storage             │
│ imgproxy            │           │ imgproxy            │           │ imgproxy            │
│ meta                │           │ meta                │           │ meta                │
│ functions           │           │ functions           │           │ functions           │
│ analytics           │           │ analytics           │           │ analytics           │
│ db (PostgreSQL)     │           │ db (PostgreSQL)     │           │ db (PostgreSQL)     │
│ vector              │           │ vector              │           │ vector              │
│ pooler (Supavisor)  │           │ pooler (Supavisor)  │           │ pooler (Supavisor)  │
│ [eigenes Netzwerk]  │           │ [eigenes Netzwerk]  │           │ [eigenes Netzwerk]  │
└─────────────────────┘           └─────────────────────┘           └─────────────────────┘
= 39 Container für 3 Projekte
= 130 Container für 10 Projekte
```

### Ressourcen-Verschwendung

| Problem | Details |
|---|---|
| **PostgreSQL** × N | Jedes Projekt startet eine **eigene** PostgreSQL-Instanz (~100-200MB RAM idle pro Instanz) |
| **Analytics/Logflare** × N | Jedes Projekt hat eine eigene Logflare-Instanz (~256-512MB RAM reserviert!) |
| **Studio** × N | Jedes Projekt startet ein eigenes Studio (Next.js-App, ~150-300MB RAM) |
| **Kong** × N | Jeder Projekt-Stack hat sein eigenes API-Gateway |
| **Vector** × N | Jeder Stack hat seinen eigenen Log-Collector |
| **imgproxy** × N | Jeder Stack hat seinen eigenen Image-Proxy |
| **Supavisor/Pooler** × N | Jeder Stack hat seinen eigenen Connection-Pooler |
| **Docker-Netzwerke** × N | Jeder Stack hat sein eigenes isoliertes Netzwerk |

**Geschätzter RAM pro Idle-Instanz: ~1.5-2.5 GB**  
**10 Instanzen = ~15-25 GB RAM** nur für identische Services die sich nicht unterscheiden.

---

## Die Lösung: Shared-Services Architektur

### Wie Supabase Cloud es macht

Supabase Cloud teilt sich Infrastruktur-Services über alle Projekte:
- **Ein** PostgreSQL-Cluster (mit Datenbank-Isolierung pro Projekt)
- **Ein** API-Gateway mit Multi-Tenant-Routing
- **Ein** Studio-Dashboard für alle Projekte
- **Ein** Analytics/Logging-System
- **Geteilter** Realtime-Service (bereits tenant-fähig designed)
- **Geteilter** Connection-Pooler

### Ziel-Architektur: "Shared Core + Lightweight Tenants"

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SHARED INFRASTRUCTURE (7 Container, fix)         │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │PostgreSQL │  │ Studio   │  │Analytics │  │ Vector   │           │
│  │ (Multi-DB)│  │ (1×)     │  │(Logflare)│  │(1× Logs) │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
│  │ imgproxy │  │Supavisor │  │  Meta    │                         │
│  │  (1×)    │  │(Pooler)  │  │  (1×)    │                         │
│  └──────────┘  └──────────┘  └──────────┘                         │
│                                                                     │
│  Gemeinsames Docker-Netzwerk: multibase-shared                     │
└─────────────────────────────────────────────────────────────────────┘
          │                    │                    │
   ┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
   │ Projekt A    │     │ Projekt B    │     │ Projekt C    │
   │ (5 Container)│     │ (5 Container)│     │ (5 Container)│
   │              │     │              │     │              │
   │ kong         │     │ kong         │     │ kong         │
   │ auth         │     │ auth         │     │ auth         │
   │ rest         │     │ rest         │     │ rest         │
   │ realtime     │     │ realtime     │     │ realtime     │
   │ storage      │     │ storage      │     │ storage      │
   │ functions    │     │ functions    │     │ functions    │
   └──────────────┘     └──────────────┘     └──────────────┘

= 7 + (6 × 3) = 25 Container für 3 Projekte   (statt 39, -36%)
= 7 + (6 × 10) = 67 Container für 10 Projekte  (statt 130, -48%)
```

### Ressourcen-Einsparung

| Metrik | Aktuell (10 Projekte) | Cloud-Version (10 Projekte) | Einsparung |
|---|---|---|---|
| **Container** | 130 | 67 | **-48%** |
| **RAM (idle)** | ~20 GB | ~8-10 GB | **-50-60%** |
| **PostgreSQL-Instanzen** | 10 | 1 | **-90%** |
| **Docker-Netzwerke** | 10 | 1 shared + 10 tenant | **-50%** |
| **Port-Verbrauch** | 60 (6×10) | 16 (6 shared + 1×10) | **-73%** |

---

## Detaillierter Implementierungsplan

### Phase 0: Vorbereitung & Infrastruktur

#### 0.1 Branch & Projekt-Setup
- [x] Branch `cloud-version` erstellen
- [ ] Alle Dateien aus `main` übernehmen (bereits durch Branch-Erstellung)
- [ ] `.gitignore` anpassen für neue Konfigurationen
- [ ] `CLOUD_VERSION_PLAN.md` (dieses Dokument) committen

#### 0.2 Neue Verzeichnisstruktur definieren
```
multibase/
├── shared/                          # NEU: Shared Infrastructure
│   ├── docker-compose.shared.yml    # Shared Services Stack
│   ├── .env.shared                  # Shared Config (DB-Passwort, JWT-Defaults)
│   └── volumes/                     # Shared Volumes
│       ├── db/                      # PostgreSQL-Daten (alle Projekt-DBs)
│       ├── logs/                    # Vector-Config
│       ├── analytics/               # Logflare-Daten
│       └── storage/                 # Gemeinsamer Storage-Root
├── projects/
│   └── {name}/
│       ├── docker-compose.yml       # NUR tenant-spezifische Services
│       ├── .env                     # Projekt-Secrets + DB-Name
│       └── volumes/
│           ├── functions/           # Edge Functions (projekt-spezifisch)
│           └── storage/             # Projekt-Storage-Bucket
├── dashboard/                       # Dashboard (angepasst)
├── templates/                       # Angepasste Templates
└── scripts/                         # Management-Scripts
```

---

### Phase 1: Shared PostgreSQL Cluster

**Priorität: HÖCHSTE** – Größte Einsparung, Basis für alles andere.

#### 1.1 Shared PostgreSQL docker-compose.shared.yml

Statt N PostgreSQL-Instanzen → **1 PostgreSQL mit mehreren Datenbanken**:

```yaml
# shared/docker-compose.shared.yml
name: multibase-shared

services:
  db:
    container_name: multibase-db
    image: supabase/postgres:15.8.1.060
    restart: unless-stopped
    ports:
      - "${SHARED_PG_PORT:-5432}:5432"
    volumes:
      - ./volumes/db/data:/var/lib/postgresql/data:Z
      - ./volumes/db/init:/docker-entrypoint-initdb.d:Z
      - db-config:/etc/postgresql-custom
    healthcheck:
      test: ['CMD', 'pg_isready', '-U', 'postgres', '-h', 'localhost']
      interval: 5s
      timeout: 5s
      retries: 10
    environment:
      POSTGRES_PASSWORD: ${SHARED_POSTGRES_PASSWORD}
      PGPORT: 5432
    command: [
      'postgres',
      '-c', 'config_file=/etc/postgresql/postgresql.conf',
      '-c', 'max_connections=500',        # Mehr Connections für Multi-Tenant
      '-c', 'shared_buffers=1GB',          # Größerer Buffer-Pool
      '-c', 'work_mem=16MB',
      '-c', 'log_min_messages=warning',
    ]
    networks:
      - multibase-shared

volumes:
  db-config:

networks:
  multibase-shared:
    name: multibase-shared
    driver: bridge
```

#### 1.2 Projekt-Datenbank-Erstellung

Bei jedem neuen Projekt wird eine **Datenbank** im shared Cluster erstellt (statt ein neuer Container):

```sql
-- Wird automatisch ausgeführt bei Projekt-Erstellung
CREATE DATABASE project_{name};
-- Alle Supabase-Schemas + Rollen werden in dieser DB erstellt
-- (realtime, webhooks, roles, jwt, pooler, logs, _supabase)
```

#### 1.3 Änderungen in `supabase_setup.py`
- **ENTFERNEN**: `db` und `vector` Service aus dem per-Projekt docker-compose Template
- **ÄNDERN**: Alle `POSTGRES_HOST` → `multibase-db` (shared Container)
- **ÄNDERN**: Alle `DB_PORT: 5432` → zeigen auf den shared PG
- **NEU**: SQL-Initialisierung der Projekt-Datenbank im shared Cluster
- **NEU**: Projekt-spezifische Passwörter für DB-Rollen

#### 1.4 Änderungen im Dashboard Backend
- `InstanceManager.ts`: Bei `create` → SQL ausführen statt neuen DB-Container starten
- `InstanceManager.ts`: Bei `delete` → Datenbank droppen statt Container löschen
- `DockerManager.ts`: Shared DB-Container aus Monitoring ausschließen
- Backup-Service: `pg_dump` gegen shared DB mit `-d project_{name}`

---

### Phase 2: Shared Analytics, Vector & Logging

**Priorität: HOCH** – Analytics/Logflare + Vector fressen je ~512MB RAM.

#### 2.1 Shared Vector (Log-Collector)

Ein Vector-Container sammelt Logs von **allen** Projekt-Containern:

```yaml
# In shared/docker-compose.shared.yml
  vector:
    container_name: multibase-vector
    image: timberio/vector:0.28.1-alpine
    restart: unless-stopped
    volumes:
      - ./volumes/logs/vector.yml:/etc/vector/vector.yml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - multibase-shared
```

Die `vector.yml` wird dynamisch angepasst um alle Projekte zu inkludieren:
```yaml
sources:
  docker_host:
    type: docker_logs
    exclude_containers:
      - multibase-vector
    # Kein include_containers Filter → sammelt ALLES

transforms:
  project_router:
    type: remap
    inputs: [docker_host]
    source: |
      # Extrahiere Projektname aus Container-Name
      .project = split!(.container_name, "-")[0]
      .event_message = del(.message)
      .appname = del(.container_name)
```

#### 2.2 Shared Analytics (Logflare)

```yaml
# In shared/docker-compose.shared.yml
  analytics:
    container_name: multibase-analytics
    image: supabase/logflare:1.12.0
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      DB_HOSTNAME: multibase-db
      DB_PORT: 5432
      DB_DATABASE: _supabase
      DB_PASSWORD: ${SHARED_POSTGRES_PASSWORD}
      POSTGRES_BACKEND_URL: postgresql://supabase_admin:${SHARED_POSTGRES_PASSWORD}@multibase-db:5432/_supabase
    networks:
      - multibase-shared
```

#### 2.3 Änderungen pro Projekt
- **ENTFERNEN**: `analytics` und `vector` Services aus Projekt-docker-compose
- **ENTFERNEN**: `depends_on: analytics` aus allen Projekt-Services
- **ÄNDERN**: Alle Services die auf Analytics zeigen → `multibase-analytics:4000`
- **ÄNDERN**: Studio `LOGFLARE_URL` → `http://multibase-analytics:4000`

---

### Phase 3: Shared Studio, Meta & imgproxy

**Priorität: MITTEL** – Studio + Meta = ~300-500MB RAM pro Instanz

#### 3.1 Shared Studio

Supabase Studio ist bereits Multi-Projekt-fähig (es hat Project-Switcher):

```yaml
# In shared/docker-compose.shared.yml
  studio:
    container_name: multibase-studio
    image: supabase/studio:20250317-6955350
    restart: unless-stopped
    ports:
      - "${STUDIO_PORT:-3000}:3000"
    environment:
      STUDIO_PG_META_URL: http://multibase-meta:8080
      POSTGRES_PASSWORD: ${SHARED_POSTGRES_PASSWORD}
      SUPABASE_URL: http://multibase-kong:8000  # Shared Kong oder Router
      SUPABASE_PUBLIC_URL: ${SUPABASE_PUBLIC_URL}
    networks:
      - multibase-shared
```

#### 3.2 Shared Meta (postgres-meta)

```yaml
  meta:
    container_name: multibase-meta
    image: supabase/postgres-meta:v0.87.1
    restart: unless-stopped
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: multibase-db
      PG_META_DB_PORT: 5432
      PG_META_DB_NAME: postgres  # Default, wird per Request gewechselt
      PG_META_DB_USER: supabase_admin
      PG_META_DB_PASSWORD: ${SHARED_POSTGRES_PASSWORD}
    networks:
      - multibase-shared
```

#### 3.3 Shared imgproxy

```yaml
  imgproxy:
    container_name: multibase-imgproxy
    image: darthsim/imgproxy:v3.8.0
    restart: unless-stopped
    volumes:
      - ./volumes/storage:/var/lib/storage:z  # Gemeinsamer Storage-Root
    environment:
      IMGPROXY_BIND: ':5001'
      IMGPROXY_LOCAL_FILESYSTEM_ROOT: /
      IMGPROXY_USE_ETAG: 'true'
    networks:
      - multibase-shared
```

---

### Phase 4: Per-Tenant Services (Lightweight Stack)

#### 4.1 Neues Projekt-Template

Jedes Projekt bekommt nur noch **6 Container** (statt 13):

```yaml
# projects/{name}/docker-compose.yml
name: {name}

services:
  kong:
    container_name: {name}-kong
    image: kong:2.8.1
    # ... (wie bisher, aber zeigt auf shared DB + Services)
    networks:
      - multibase-shared
      - default

  auth:
    container_name: {name}-auth
    image: supabase/gotrue:v2.170.0
    environment:
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@multibase-db:5432/${PROJECT_DB}
    networks:
      - multibase-shared
      - default

  rest:
    container_name: {name}-rest
    image: postgrest/postgrest:v12.2.8
    environment:
      PGRST_DB_URI: postgres://authenticator:${POSTGRES_PASSWORD}@multibase-db:5432/${PROJECT_DB}
    networks:
      - multibase-shared
      - default

  realtime:
    container_name: realtime-dev.{name}-realtime
    image: supabase/realtime:v2.34.43
    environment:
      DB_HOST: multibase-db
      DB_PORT: 5432
      DB_NAME: ${PROJECT_DB}
    networks:
      - multibase-shared
      - default

  storage:
    container_name: {name}-storage
    image: supabase/storage-api:v1.19.3
    volumes:
      - ./volumes/storage:/var/lib/storage:z
    environment:
      DATABASE_URL: postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@multibase-db:5432/${PROJECT_DB}
      IMGPROXY_URL: http://multibase-imgproxy:5001
    networks:
      - multibase-shared
      - default

  functions:
    container_name: {name}-edge-functions
    image: supabase/edge-runtime:v1.67.4
    volumes:
      - ./volumes/functions:/home/deno/functions:Z
    environment:
      SUPABASE_DB_URL: postgresql://postgres:${POSTGRES_PASSWORD}@multibase-db:5432/${PROJECT_DB}
    networks:
      - multibase-shared
      - default

networks:
  multibase-shared:
    external: true
  default:
    name: {name}-network
```

#### 4.2 Neue .env pro Projekt

```env
# Reduziert: nur projekt-spezifische Werte
PROJECT_DB=project_{name}              # DB-Name im Shared Cluster
POSTGRES_PASSWORD={unique_password}     # Projekt-spezifisches PW
JWT_SECRET={unique_jwt_secret}
ANON_KEY={generated}
SERVICE_ROLE_KEY={generated}
# ... (Auth, SMTP etc. wie bisher)
```

---

### Phase 5: Dashboard Backend Anpassungen

#### 5.1 Neuer SharedInfraManager Service

```typescript
// dashboard/backend/src/services/SharedInfraManager.ts
// Verwaltet den Shared-Stack (Start/Stop/Health)
// Erstellt/löscht Projekt-Datenbanken im Shared PostgreSQL
// Aktualisiert Vector-Config bei Projekt-Änderungen
```

#### 5.2 Änderungen in bestehenden Services

| Service | Änderung |
|---|---|
| **InstanceManager.ts** | `createInstance()` → erstellt DB im Cluster + startet nur 6 Container |
| **InstanceManager.ts** | `deleteInstance()` → dropped DB + entfernt 6 Container |
| **DockerManager.ts** | Shared Container separat monitoren + Status-Aggregation |
| **HealthMonitor.ts** | Shared Services als "System Health" separat tracken |
| **MetricsCollector.ts** | Shared DB-Metriken auf Projekte aufteilen (per-DB Stats) |
| **BackupService.ts** | `pg_dump -d project_{name}` statt Container-exec |
| **UptimeService.ts** | Studio-URL ändert sich (ein Studio, mehrere Projekte) |

#### 5.3 Neue API-Endpunkte

```
GET  /api/shared/status          # Status der Shared-Infrastruktur
POST /api/shared/start           # Shared-Stack starten
POST /api/shared/stop            # Shared-Stack stoppen
GET  /api/shared/metrics         # Shared-Service-Metriken (DB, Analytics etc.)
POST /api/shared/db/optimize     # VACUUM, ANALYZE auf dem Cluster
```

---

### Phase 6: Dashboard Frontend Anpassungen

#### 6.1 Neue UI-Komponenten

| Komponente | Funktion |
|---|---|
| **SharedInfraPanel** | Zeigt Status der 7 Shared-Container (DB, Studio, Analytics etc.) |
| **DatabaseClusterView** | Zeigt alle Projekt-DBs im Cluster (Größe, Connections, Performance) |
| **ResourceOverview** | Vergleich: Aktuell vs. Cloud-Version RAM/CPU-Verbrauch |
| **SystemHealthBadge** | Globaler Indikator: "Shared Infrastructure: Healthy/Degraded/Down" |

#### 6.2 Angepasste Seiten

| Seite | Änderung |
|---|---|
| **Dashboard** | Neuer Bereich: "Shared Infrastructure" mit Status-Cards |
| **InstanceDetail** | DB-Tab zeigt jetzt Datenbank im Cluster (nicht eigener Container) |
| **InstanceDetail** | Services-Tab zeigt nur 6 Container + Links zu Shared Services |
| **CreateInstanceModal** | Kein Port-Mapping mehr für DB/Analytics/Studio |

---

### Phase 7: Nginx & Routing Anpassungen

#### 7.1 Vereinfachtes Nginx-Routing

```nginx
# Ein Studio für alle Projekte
server {
    server_name studio.backend.tyto-design.de;
    location / {
        proxy_pass http://127.0.0.1:3000;  # Shared Studio
    }
}

# Pro Projekt: nur noch API-Routing
server {
    server_name {name}-api.backend.tyto-design.de;
    location / {
        proxy_pass http://127.0.0.1:{KONG_PORT};  # Projekt-Kong
    }
}
```

---

### Phase 8: Erweiterte Optimierungen (Optional/Zukunft)

#### 8.1 Shared Kong (Single API Gateway)
Statt N Kong-Instanzen → 1 Kong mit Multi-Tenant-Routing über Plugins:
- Consumer pro Projekt
- Route-Prefix: `/{project-name}/rest/v1/`, `/{project-name}/auth/v1/` etc.
- **Einsparung**: N weitere Container

#### 8.2 Shared Realtime (Multi-Tenant)
Supabase Realtime ist bereits tenant-fähig (`SEED_SELF_HOST`):
- 1 Realtime-Instanz, tenant-Routing über DB-Konfiguration
- **Einsparung**: N-1 Container

#### 8.3 Shared Auth (GoTrue Multi-Tenant)
- Separate Schemas pro Projekt in der gleichen DB
- 1 GoTrue-Instanz mit dynamischem DB-Switching
- **Einsparung**: N-1 Container

#### 8.4 Ultimative Architektur (Maximum Sharing)

```
Shared: DB, Studio, Meta, Analytics, Vector, imgproxy, Kong, Realtime, Auth, Pooler
Per-Project: REST (PostgREST), Storage, Functions

= 10 shared + (3 × N) Container
= 10 + 30 = 40 für 10 Projekte (statt 130 = -69%)
```

---

## Umsetzungs-Reihenfolge (Empfehlung)

| Phase | Was | Aufwand | Impact | Risiko |
|---|---|---|---|---|
| **Phase 0** | Branch + Projektstruktur | 1 Tag | ⭐ | 🟢 Niedrig |
| **Phase 1** | Shared PostgreSQL | 3-5 Tage | ⭐⭐⭐⭐⭐ | 🟡 Mittel |
| **Phase 2** | Shared Analytics + Vector | 2-3 Tage | ⭐⭐⭐⭐ | 🟢 Niedrig |
| **Phase 3** | Shared Studio + Meta + imgproxy | 2-3 Tage | ⭐⭐⭐ | 🟡 Mittel |
| **Phase 4** | Lightweight Tenant Template | 3-4 Tage | ⭐⭐⭐⭐⭐ | 🟡 Mittel |
| **Phase 5** | Backend Anpassungen | 5-7 Tage | ⭐⭐⭐⭐ | 🟠 Hoch |
| **Phase 6** | Frontend Anpassungen | 3-5 Tage | ⭐⭐⭐ | 🟢 Niedrig |
| **Phase 7** | Nginx & Routing | 1-2 Tage | ⭐⭐ | 🟢 Niedrig |
| **Phase 8** | Erweiterte Optimierungen | Optional | ⭐⭐⭐ | 🟠 Hoch |

**Geschätzter Gesamtaufwand: 20-30 Tage**

---

## Migration bestehender Projekte

Für den Übergang von der alten zur neuen Architektur:

1. **Shared Infrastructure starten** (Phase 1-3)
2. **Für jedes bestehende Projekt:**
   a. `pg_dump` der Projekt-DB erstellen
   b. DB im Shared-Cluster erstellen
   c. `pg_restore` in die neue DB
   d. Neuen Lightweight-Stack generieren
   e. Alten Full-Stack herunterfahren
   f. Neuen Stack starten + verifizieren
3. **Alte Container/Volumes aufräumen**

---

## Risiken & Mitigierung

| Risiko | Wahrscheinlichkeit | Mitigierung |
|---|---|---|
| Shared DB Crash betrifft alle Projekte | Mittel | PostgreSQL WAL + regelmäßige Backups + Replikation |
| Netzwerk-Isolierung zwischen Projekten | Gering | Docker-Netzwerk-Policies + PostgreSQL Row-Level-Security |
| Migration bestehender Daten | Mittel | Getestete Migration-Scripts + Rollback-Plan |
| Studio Multi-Tenant Kompatibilität | Gering | Studio unterstützt bereits mehrere Projekte |
| Performance-Degradation bei vielen Projekten | Mittel | PostgreSQL-Tuning + Monitoring + Connection Limits |

---

## Vergleich: Vorher vs. Nachher

### 3 Projekte
| | Vorher | Nachher | Einsparung |
|---|---|---|---|
| Container | 39 | 25 | **-36%** |
| RAM (geschätzt) | ~6 GB | ~3.5 GB | **-42%** |
| PostgreSQL-Instanzen | 3 | 1 | **-67%** |
| Ports | 18 | 10 | **-44%** |

### 10 Projekte
| | Vorher | Nachher | Einsparung |
|---|---|---|---|
| Container | 130 | 67 | **-48%** |
| RAM (geschätzt) | ~20 GB | ~8 GB | **-60%** |
| PostgreSQL-Instanzen | 10 | 1 | **-90%** |
| Ports | 60 | 16 | **-73%** |

### 50 Projekte (Skalierungstest)
| | Vorher | Nachher | Einsparung |
|---|---|---|---|
| Container | 650 | 307 | **-53%** |
| RAM (geschätzt) | ~100 GB | ~25 GB | **-75%** |
| PostgreSQL-Instanzen | 50 | 1 | **-98%** |
| Ports | 300 | 56 | **-81%** |
