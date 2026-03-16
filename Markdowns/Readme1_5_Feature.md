# V1.5 Implementation Plan — Feature-Roadmap

> Detaillierter Frontend & Backend Implementationsplan basierend auf der bestehenden Projektstruktur.
> Stand: März 2026

---

## Überblick der v1.5 Features

| # | Feature | Platzierung | Aufwand | Priorität |
|---|---------|-------------|---------|-----------|
| 1 | GraphQL API Playground | `ApiTab.tsx` (Erweiterung) | Klein | Hoch |
| 2 | Database Webhooks UI | Neuer Tab in `SupabaseManager` | Mittel | Hoch |
| 3 | Cron Job Manager | Neuer Tab in `SupabaseManager` | Mittel | Hoch |
| 4 | AI & Vectors (pgvector) | Neuer Tab in `SupabaseManager` | Mittel | Sehr hoch |
| 5 | Message Queues (pgmq) | Neuer Tab in `SupabaseManager` | Mittel | Mittel |

---

## Architektur-Entscheidungen

### Wo gehören neue Features hin?

Das Projekt hat zwei Bereiche für Instance-bezogene Features:

```
InstanceDetail (/instance/:name)
  ├── ServicesTab      → Container-Kontrolle, Health
  ├── MetricsTab       → CPU/RAM Charts
  ├── LogsTab          → Live Logs
  ├── CredentialsTab   → Connection Strings
  ├── DatabaseTab      → Postgres Schema-Übersicht
  ├── AuthTab          → OAuth Provider Config ✅
  ├── ApiTab           → REST/GraphQL Keys & Endpoints
  ├── StorageSettingsTab → S3 Bucket Config
  ├── SmtpTab          → E-Mail Konfiguration
  └── EnvironmentTab   → Env Variables

SupabaseManager (/workspace → Manager-Tab)
  ├── DatabaseTab      → TableDataBrowser + SQL Editor
  ├── StorageTab       → Dateimanager
  ├── PoliciesTab      → RLS Editor ✅
  └── FunctionsTab     → Edge Functions
```

**Entscheidung:** Alle neuen v1.5 Developer-Tools kommen als neue Tabs in `SupabaseManager`:
- SupabaseManager ist der "Developer Workspace" für tenant-spezifische Daten
- GraphQL Playground → Erweiterung von `ApiTab` in InstanceDetail (UI/Config-Kontext)
- Webhooks, Cron, Vectors, Queues → neue Tabs in SupabaseManager (Daten-Kontext)

---

## Feature 1 — GraphQL API Playground

### Platzierung
**`dashboard/frontend/src/components/ApiTab.tsx`** — neuer Abschnitt unterhalb der bestehenden API-Konfiguration.

### Beschreibung
`ApiTab.tsx` zeigt bereits `graphql_public` als exponiertes Schema. Wir ergänzen eine dedizierte GraphQL-Sektion mit Endpoint-Anzeige, Copy-Button und einem "Open Playground" Link.

### Frontend Tasks

**Datei:** `dashboard/frontend/src/components/ApiTab.tsx`

```
Task FE-1.1: GraphQL-Sektion in ApiTab ergänzen
  - Neues Card/Section-Element unterhalb der REST-API Sektion
  - Endpoint-URL anzeigen: http(s)://<instance-domain>/graphql/v1
  - Anon Key + Service Role Key als verwendbare Header zeigen (Copy-Button)
  - "GraphQL aktiviert?"-Toggle mit Hinweis auf graphql_public Schema
  - Button "Open GraphQL Explorer" → öffnet neues Tab mit eingebetteter
    GraphiQL URL (kann die Studio-GraphQL-UI nutzen falls verfügbar)
```

**Datei:** (optional) `dashboard/frontend/src/components/GraphQLPlayground.tsx`

```
Task FE-1.2: (Optional) Eingebetteter Mini-Playground
  - <iframe> der auf den GraphQL-Endpoint zeigt mit Auth-Header
  - Oder: Link zu externer GraphiQL-Instanz (z.B. studio.supabase.com/graphql)
  - Einfacher Query-Editor mit vorgefertigten Beispiel-Queries
```

### Backend Tasks

```
Task BE-1.1: Kein neuer Endpoint nötig
  - GraphQL läuft bereits über PostgREST via Nginx Gateway
  - Sicherstellen, dass PGRST_DB_SCHEMAS="public,storage,graphql_public"
    standardmäßig in der Instance-Konfiguration gesetzt ist
  - Prüfen in InstanceManager.ts wo die PGRST_DB_SCHEMAS env var gesetzt wird
```

**Datei:** `dashboard/backend/src/routes/instances.ts`

```
Task BE-1.2: GET /api/instances/:name/graphql-status
  - Führt SQL aus: SELECT * FROM extensions WHERE name = 'pg_graphql'
  - Gibt zurück ob die Extension aktiviert ist
  - Wird vom Frontend für den Toggle genutzt
```

---

## Feature 2 — Database Webhooks UI

### Platzierung
**Neuer Tab in `SupabaseManager`**: `'webhooks'`
- Component: `dashboard/frontend/src/components/WebhooksTab.tsx`

### Beschreibung
Database Webhooks sind Postgres-Trigger die via `pg_net`-Extension HTTP-Requests auslösen. Wir brauchen eine UI zum Erstellen, Anzeigen und Löschen dieser Trigger.

### Frontend Tasks

**Datei:** `dashboard/frontend/src/pages/SupabaseManager.tsx`

```
Task FE-2.1: Neuen Tab "Webhooks" hinzufügen
  - TabType um 'webhooks' erweitern
  - Neuen Tab-Button mit Webhook-Icon (lucide: Webhook)
  - WebhooksTab-Komponente einbinden
```

**Datei:** `dashboard/frontend/src/components/WebhooksTab.tsx` (neu)

```
Task FE-2.2: WebhooksTab Komponente erstellen
  Struktur:
  ├── Header: "Database Webhooks" + "Create Webhook"-Button
  ├── Webhook-Liste (Tabelle):
  │   ├── Name
  │   ├── Tabelle (schema.table)
  │   ├── Events (INSERT/UPDATE/DELETE Badges)
  │   ├── Endpoint URL
  │   ├── Status (enabled/disabled)
  │   └── Aktionen (Test, Delete)
  └── CreateWebhookModal (inline oder separate Datei)
```

**Datei:** `dashboard/frontend/src/components/CreateWebhookModal.tsx` (neu)

```
Task FE-2.3: CreateWebhookModal
  Felder:
  ├── Name (text input)
  ├── Schema (select: public, auth, storage, ...)
  ├── Tabelle (select: dynamisch aus Tabellenliste geladen)
  ├── Events (checkboxes: INSERT, UPDATE, DELETE)
  ├── HTTP-Methode (POST / GET)
  ├── Endpoint URL (text input mit Validierung)
  ├── Custom Headers (key-value Editor, optional)
  └── Timeout in ms (number input, default 5000)
```

### Backend Tasks

**Datei:** `dashboard/backend/src/routes/webhooks.ts` (neu)

```
Task BE-2.1: Neue Route-Datei erstellen
  GET    /api/instances/:name/webhooks         → Liste aller Webhooks
  POST   /api/instances/:name/webhooks         → Webhook erstellen
  DELETE /api/instances/:name/webhooks/:id     → Webhook löschen
  POST   /api/instances/:name/webhooks/:id/test → Webhook testen
```

**Datei:** `dashboard/backend/src/services/WebhookService.ts` (neu)

```
Task BE-2.2: WebhookService erstellen
  
  listWebhooks(instanceName):
    SQL: SELECT trigger_name, event_manipulation, event_object_table,
              action_statement FROM information_schema.triggers
         WHERE trigger_schema = 'public'
    Parst die SQL-Action um URL/Method zu extrahieren

  createWebhook(instanceName, config):
    Generiert CREATE TRIGGER SQL mit supabase_functions.http_request()
    Beispiel:
    CREATE TRIGGER "my-webhook"
    AFTER INSERT ON "public"."my_table"
    FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request(
      'https://example.com/webhook',
      'POST',
      '{"Content-Type":"application/json"}',
      '{}',
      '5000'
    );

  deleteWebhook(instanceName, triggerName):
    SQL: DROP TRIGGER IF EXISTS "name" ON "schema"."table"

  testWebhook(instanceName, webhookId):
    Löst einen Test-Payload via pg_net aus
```

**Datei:** `dashboard/backend/src/server.ts`

```
Task BE-2.3: Route registrieren
  app.use('/api/instances', createWebhookRoutes(instanceManager, prisma));
```

### Prisma Schema

```
Kein neues Model nötig — Webhooks werden direkt in der Tenant-DB gespeichert
(als Postgres Trigger), nicht in der Multibase SQLite DB.
```

---

## Feature 3 — Cron Job Manager (pg_cron)

### Platzierung
**Neuer Tab in `SupabaseManager`**: `'cron'`
- Component: `dashboard/frontend/src/components/CronJobsTab.tsx`

### Beschreibung
`pg_cron` ist eine Postgres-Extension, die bereits in Supabase-PostgreSQL enthalten ist. Jobs werden in `cron.job` gespeichert, Run-History in `cron.job_run_details`. Wir bauen eine UI um Jobs zu erstellen, zu überwachen und zu löschen — unabhängig vom bestehenden BackupScheduler, der nur Multibase-intern läuft.

### Frontend Tasks

**Datei:** `dashboard/frontend/src/pages/SupabaseManager.tsx`

```
Task FE-3.1: Neuen Tab "Cron Jobs" hinzufügen
  - TabType um 'cron' erweitern
  - Tab-Button mit Clock-Icon (lucide: Clock)
  - CronJobsTab-Komponente einbinden
```

**Datei:** `dashboard/frontend/src/components/CronJobsTab.tsx` (neu)

```
Task FE-3.2: CronJobsTab Komponente
  Struktur:
  ├── Header: "Cron Jobs" + "Create Job"-Button + Hinweis-Banner
  │   (Hinweis: max. 8 parallele Jobs, max. 10 min Laufzeit)
  ├── Job-Tabelle:
  │   ├── Job-Name
  │   ├── Schedule (Cron-Syntax, z.B. "0 2 * * *")
  │   ├── Command (SQL oder HTTP endpoint)
  │   ├── Letzter Run (Zeitstempel)
  │   ├── Status (succeeded/failed letzter Run)
  │   ├── Active-Toggle
  │   └── Aktionen (Run Now, View History, Delete)
  ├── ExpandRow: Job-Run-History (letzten 10 Ausführungen)
  │   ├── Run-Zeit
  │   ├── Status (succeeded/failed)
  │   └── Return-Value / Error-Message
  └── CreateCronJobModal
```

**Datei:** `dashboard/frontend/src/components/CreateCronJobModal.tsx` (neu)

```
Task FE-3.3: CreateCronJobModal
  Felder:
  ├── Job-Name (text input)
  ├── Schedule (text input mit Cron-Syntax Validierung)
  │   + Cron-Helper: Dropdowns für gängige Intervalle
  │     (Jede Stunde / Täglich um X Uhr / Wöchentlich / Monatlich / Custom)
  ├── Command-Typ (radio: SQL | HTTP Request)
  ├── SQL-Command (textarea, bei Typ=SQL)
  │   └── Vorschläge: "SELECT", "DELETE old rows", "CALL function()"
  └── HTTP URL (text input, bei Typ=HTTP)
      + Method (GET/POST)
```

### Backend Tasks

**Datei:** `dashboard/backend/src/routes/cron.ts` (neu)

```
Task BE-3.1: Route-Datei erstellen
  GET    /api/instances/:name/cron              → Liste aller Jobs
  POST   /api/instances/:name/cron              → Job erstellen
  DELETE /api/instances/:name/cron/:jobId       → Job löschen
  PATCH  /api/instances/:name/cron/:jobId       → Job aktivieren/deaktivieren
  POST   /api/instances/:name/cron/:jobId/run   → Job sofort ausführen
  GET    /api/instances/:name/cron/:jobId/runs  → Run-History eines Jobs
```

**Datei:** `dashboard/backend/src/services/CronService.ts` (neu)

```
Task BE-3.2: CronService erstellen

  listJobs(instanceName):
    SQL: SELECT jobid, jobname, schedule, command, active,
              username FROM cron.job ORDER BY jobid

  createJob(instanceName, { name, schedule, command }):
    SQL: SELECT cron.schedule($name, $schedule, $command)

  deleteJob(instanceName, jobId):
    SQL: SELECT cron.unschedule($jobId)

  toggleJob(instanceName, jobId, active):
    SQL: UPDATE cron.job SET active = $active WHERE jobid = $jobId

  runJobNow(instanceName, jobId):
    Holt den Command aus cron.job, führt ihn direkt aus

  getJobRuns(instanceName, jobId, limit = 20):
    SQL: SELECT runid, jobid, job_pid, database, username,
              command, status, return_message, start_time, end_time
         FROM cron.job_run_details
         WHERE jobid = $jobId
         ORDER BY start_time DESC LIMIT $limit
```

**Datei:** `dashboard/backend/src/server.ts`

```
Task BE-3.3: Route registrieren
  app.use('/api/instances', createCronRoutes(instanceManager, prisma));
```

---

## Feature 4 — AI & Vectors (pgvector)

### Platzierung
**Neuer Tab in `SupabaseManager`**: `'vectors'`
- Component: `dashboard/frontend/src/components/VectorsTab.tsx`

### Beschreibung
pgvector ist eine Postgres-Extension für Vektor-Embeddings und Similarity-Search. Sie ist in Supabase-PostgreSQL enthalten, muss aber aktiviert werden (`CREATE EXTENSION vector`). Wir bauen eine UI zur Verwaltung von Vector-Columns, Collections und einem Test-Interface für Similarity-Search.

### Frontend Tasks

**Datei:** `dashboard/frontend/src/pages/SupabaseManager.tsx`

```
Task FE-4.1: Neuen Tab "Vectors" hinzufügen
  - TabType um 'vectors' erweitern
  - Tab-Button mit Brain/Zap-Icon (lucide: Brain oder Cpu)
  - VectorsTab-Komponente einbinden
```

**Datei:** `dashboard/frontend/src/components/VectorsTab.tsx` (neu)

```
Task FE-4.2: VectorsTab Komponente
  Struktur:
  ├── Extension-Status Banner
  │   ├── pgvector: ✅ Aktiviert / ❌ Nicht aktiviert
  │   └── "Extension aktivieren"-Button (falls inaktiv)
  │
  ├── Sektion: Vector Columns
  │   ├── Tabelle aller Spalten mit vector-Typ
  │   │   ├── Schema.Tabelle.Spalte
  │   │   ├── Dimension (z.B. 1536 für OpenAI, 768 für Gemini)
  │   │   └── Anzahl Einträge
  │   └── "Add Vector Column"-Button → CreateVectorColumnModal
  │
  ├── Sektion: Indexes
  │   ├── Liste aller ivfflat/hnsw Indexes
  │   ├── Index-Typ, Tabelle, Status
  │   └── "Create Index"-Button
  │
  └── Sektion: Similarity Search Tester
      ├── Tabelle/Spalte auswählen (dropdowns)
      ├── Query-Vektor eingeben (JSON array oder Text→Embedding)
      ├── Anzahl Ergebnisse (k = 5)
      ├── Distanz-Metrik (cosine / euclidean / inner product)
      └── Ergebnis-Tabelle mit Ähnlichkeits-Score
```

**Datei:** `dashboard/frontend/src/components/CreateVectorColumnModal.tsx` (neu)

```
Task FE-4.3: CreateVectorColumnModal
  Felder:
  ├── Tabelle (select aus vorhandenen Tabellen)
  ├── Spaltenname (text input)
  ├── Dimension (number: 1536=OpenAI, 768=Gemini, 384=small models)
  │   + Schnellauswahl-Buttons für gängige Modelle
  └── Index erstellen? (toggle: ivfflat/hnsw)
```

### Backend Tasks

**Datei:** `dashboard/backend/src/routes/vectors.ts` (neu)

```
Task BE-4.1: Route-Datei erstellen
  GET    /api/instances/:name/vectors/status         → Extension-Status
  POST   /api/instances/:name/vectors/enable         → Extension aktivieren
  GET    /api/instances/:name/vectors/columns        → Alle vector-Spalten
  POST   /api/instances/:name/vectors/columns        → Vector-Spalte hinzufügen
  GET    /api/instances/:name/vectors/indexes        → Alle Vector-Indexes
  POST   /api/instances/:name/vectors/indexes        → Index erstellen
  DELETE /api/instances/:name/vectors/indexes/:name  → Index löschen
  POST   /api/instances/:name/vectors/search         → Similarity Search
```

**Datei:** `dashboard/backend/src/services/VectorService.ts` (neu)

```
Task BE-4.2: VectorService erstellen

  getStatus(instanceName):
    SQL: SELECT * FROM pg_extension WHERE extname = 'vector'

  enableExtension(instanceName):
    SQL: CREATE EXTENSION IF NOT EXISTS vector

  listVectorColumns(instanceName):
    SQL: SELECT table_schema, table_name, column_name,
              udt_name, character_maximum_length
         FROM information_schema.columns
         WHERE udt_name = 'vector'

  addVectorColumn(instanceName, { table, column, dimension }):
    SQL: ALTER TABLE $table ADD COLUMN $column vector($dimension)

  listIndexes(instanceName):
    SQL: SELECT indexname, tablename, indexdef
         FROM pg_indexes
         WHERE indexdef LIKE '%ivfflat%' OR indexdef LIKE '%hnsw%'

  createIndex(instanceName, { table, column, type, lists }):
    SQL: CREATE INDEX ON $table USING ivfflat ($column vector_cosine_ops)
         WITH (lists = $lists)

  similaritySearch(instanceName, { table, column, vector, k, metric }):
    SQL: SELECT *, $column <=> $vector AS score
         FROM $table
         ORDER BY $column <=> $vector
         LIMIT $k
    (Operator je nach metric: <=> cosine, <-> L2, <#> inner product)
```

**Datei:** `dashboard/backend/src/server.ts`

```
Task BE-4.3: Route registrieren
  app.use('/api/instances', createVectorRoutes(instanceManager, prisma));
```

### AI Chat Agent Integration

**Datei:** `dashboard/backend/src/services/AiAgentService.ts`

```
Task BE-4.4: Neue Tools für den AI Chat Agent
  vectorStatus:       → Prüft ob pgvector aktiv ist
  enableVector:       → Aktiviert pgvector Extension
  createVectorColumn: → Erstellt eine neue Vector-Spalte
  searchVector:       → Führt Similarity Search aus
```

---

## Feature 5 — Message Queues (pgmq)

### Platzierung
**Neuer Tab in `SupabaseManager`**: `'queues'`
- Component: `dashboard/frontend/src/components/QueuesTab.tsx`

### Beschreibung
pgmq ist eine Postgres-native Message Queue Extension. Queues werden als Postgres-Tabellen angelegt. Messages lassen sich senden, empfangen, acknowledge und archivieren. Ideal für Background-Jobs und Event-Driven Architectures.

### Frontend Tasks

**Datei:** `dashboard/frontend/src/pages/SupabaseManager.tsx`

```
Task FE-5.1: Neuen Tab "Queues" hinzufügen
  - TabType um 'queues' erweitern
  - Tab-Button mit ListOrdered-Icon (lucide: ListOrdered)
  - QueuesTab-Komponente einbinden
```

**Datei:** `dashboard/frontend/src/components/QueuesTab.tsx` (neu)

```
Task FE-5.2: QueuesTab Komponente
  Struktur:
  ├── Extension-Status Banner
  │   ├── pgmq: ✅ Aktiviert / ❌ Nicht aktiviert
  │   └── "Extension aktivieren"-Button
  │
  ├── Queue-Liste (linke Spalte oder Kacheln):
  │   ├── Queue-Name
  │   ├── Message-Anzahl (depth)
  │   ├── Älteste unverarbeitete Message (age)
  │   └── Aktionen: Öffnen, Delete Queue
  │
  ├── Create Queue-Button → CreateQueueModal
  │
  └── Queue-Detail (rechte Spalte bei Auswahl):
      ├── Messages-Tabelle (letzte 20):
      │   ├── msg_id
      │   ├── enqueued_at
      │   ├── vt (visibility timeout)
      │   ├── read_ct (wie oft gelesen)
      │   └── message (JSON, aufklappbar)
      ├── "Send Test Message"-Button
      └── "Purge Queue"-Button
```

**Datei:** `dashboard/frontend/src/components/CreateQueueModal.tsx` (neu)

```
Task FE-5.3: CreateQueueModal
  Felder:
  ├── Queue-Name (text input, lowercase_snake_case)
  └── Queue-Typ (radio: Standard / Partitioned)
```

### Backend Tasks

**Datei:** `dashboard/backend/src/routes/queues.ts` (neu)

```
Task BE-5.1: Route-Datei erstellen
  GET    /api/instances/:name/queues               → Liste aller Queues
  POST   /api/instances/:name/queues               → Queue erstellen
  DELETE /api/instances/:name/queues/:queueName    → Queue löschen
  GET    /api/instances/:name/queues/:queueName/messages   → Messages lesen
  POST   /api/instances/:name/queues/:queueName/send       → Message senden
  POST   /api/instances/:name/queues/:queueName/purge      → Queue leeren
  GET    /api/instances/:name/queues/status                → Extension-Status
  POST   /api/instances/:name/queues/enable                → Extension aktivieren
```

**Datei:** `dashboard/backend/src/services/QueueService.ts` (neu)

```
Task BE-5.2: QueueService erstellen

  getStatus(instanceName):
    SQL: SELECT * FROM pg_extension WHERE extname = 'pgmq'

  enableExtension(instanceName):
    SQL: CREATE EXTENSION IF NOT EXISTS pgmq

  listQueues(instanceName):
    SQL: SELECT queue_name, created_at FROM pgmq.list_queues()

  createQueue(instanceName, { name }):
    SQL: SELECT pgmq.create($name)

  deleteQueue(instanceName, name):
    SQL: SELECT pgmq.drop_queue($name)

  readMessages(instanceName, { queueName, limit = 20 }):
    SQL: SELECT * FROM pgmq.read($queueName, 30, $limit)
    (vt=30 = 30 Sekunden Sichtbarkeits-Timeout fürs Lesen)

  sendMessage(instanceName, { queueName, message }):
    SQL: SELECT pgmq.send($queueName, $message::jsonb)

  purgeQueue(instanceName, queueName):
    SQL: SELECT pgmq.purge_queue($queueName)

  getQueueDepth(instanceName, queueName):
    SQL: SELECT * FROM pgmq.metrics($queueName)
```

**Datei:** `dashboard/backend/src/server.ts`

```
Task BE-5.3: Route registrieren
  app.use('/api/instances', createQueueRoutes(instanceManager, prisma));
```

---

## Zusammenfassung aller neuen Dateien

### Neue Frontend-Dateien

```
dashboard/frontend/src/components/
├── WebhooksTab.tsx          // Feature 2
├── CreateWebhookModal.tsx   // Feature 2
├── CronJobsTab.tsx          // Feature 3
├── CreateCronJobModal.tsx   // Feature 3
├── VectorsTab.tsx           // Feature 4
├── CreateVectorColumnModal.tsx  // Feature 4
├── QueuesTab.tsx            // Feature 5
└── CreateQueueModal.tsx     // Feature 5
```

### Geänderte Frontend-Dateien

```
dashboard/frontend/src/components/ApiTab.tsx
  └── GraphQL-Sektion hinzufügen (Feature 1)

dashboard/frontend/src/pages/SupabaseManager.tsx
  └── TabType + 4 neue Tabs: webhooks, cron, vectors, queues
      (Komponenten einbinden, Tab-Buttons hinzufügen)
```

### Neue Backend-Dateien

```
dashboard/backend/src/routes/
├── webhooks.ts      // Feature 2
├── cron.ts          // Feature 3
├── vectors.ts       // Feature 4
└── queues.ts        // Feature 5

dashboard/backend/src/services/
├── WebhookService.ts  // Feature 2
├── CronService.ts     // Feature 3
├── VectorService.ts   // Feature 4
└── QueueService.ts    // Feature 5
```

### Geänderte Backend-Dateien

```
dashboard/backend/src/server.ts
  └── 4 neue Route-Registrierungen

dashboard/backend/src/services/AiAgentService.ts
  └── 4 neue Tools für pgvector (Feature 4)

dashboard/backend/src/routes/instances.ts
  └── GET /api/instances/:name/graphql-status (Feature 1)
```

### Prisma Schema

```
Kein neues Model nötig.
Alle neuen Features lesen/schreiben direkt in die Tenant-PostgreSQL-Datenbank
via SQL-Execution (analog zu bestehenden FunctionService, StorageService).
```

---

## Implementierungs-Reihenfolge (Empfehlung)

```
Sprint 1 (Einfach, Basis legen):
  1. Feature 1: GraphQL Sektion in ApiTab (1-2 Tage)
  2. Feature 3: Cron Jobs Backend + Frontend (3-4 Tage)

Sprint 2 (Mittel):
  3. Feature 2: Database Webhooks (3-4 Tage)
  4. Feature 5: Message Queues (3-4 Tage)

Sprint 3 (Komplex, Differenzierung):
  5. Feature 4: pgvector / AI Vectors (5-7 Tage)
     → Zuletzt, da am meisten Mehrwert und Testaufwand
```

---

## SupabaseManager Tab-Übersicht nach v1.5

```
SupabaseManager Tabs (aktuell: 4 → v1.5: 8 Tabs):
  1. Database       → TableDataBrowser + SQL Editor  ✅ bereits vorhanden
  2. Storage        → Dateimanager                   ✅ bereits vorhanden
  3. RLS Policies   → RLS Editor                     ✅ bereits vorhanden
  4. Functions      → Edge Functions                 ✅ bereits vorhanden
  ─────────────────────────────────────────────────────────────
  5. Webhooks       → Database Webhooks UI            🆕 v1.5
  6. Cron Jobs      → pg_cron Manager                🆕 v1.5
  7. Vectors        → pgvector / AI Embeddings        🆕 v1.5
  8. Queues         → pgmq Message Queues             🆕 v1.5
```

---

*Erstellt: März 2026 | Branch: Feature_Roadmap*
