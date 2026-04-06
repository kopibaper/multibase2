# Version 1.5 — Developer Tools
description: GraphQL API Playground, Database Webhooks, Cron Job Manager, pgvector AI Embeddings, Message Queues

**Status:** ✅ Released  
**Release:** March 2026  
**Use Case:** Advanced developer tooling directly inside the Supabase Manager workspace

---

## 🎯 Overview

v1.5 expands the **SupabaseManager** workspace with 4 new developer-focused tabs and extends the existing `ApiTab` with a GraphQL section. All features interact directly with the tenant's PostgreSQL database via SQL execution — no extra infrastructure required.

| # | Feature | Location | Priority |
|---|---------|----------|----------|
| 1 | GraphQL API Playground | `ApiTab.tsx` extension | High |
| 2 | Database Webhooks UI | New tab `webhooks` in SupabaseManager | High |
| 3 | Cron Job Manager | New tab `cron` in SupabaseManager | High |
| 4 | AI & Vectors (pgvector) | New tab `vectors` in SupabaseManager | Very High |
| 5 | Message Queues (pgmq) | New tab `queues` in SupabaseManager | Medium |

---

## 🔷 GraphQL API Playground ✅

**Priority:** High  
**Effort:** Small

### Description

The existing `ApiTab.tsx` already exposes `graphql_public` as a schema. v1.5 adds a dedicated GraphQL section below the REST-API configuration with endpoint display, copy buttons, and a direct link to open the GraphQL Explorer.

### Key Features

- **Endpoint Display**: Shows `http(s)://<instance-domain>/graphql/v1`
- **Auth Headers**: Anon Key + Service Role Key with copy buttons
- **Extension Status**: Shows whether `pg_graphql` is enabled
- **Open GraphQL Explorer**: Button to launch GraphiQL in a new tab
- **Backend Check**: `GET /api/instances/:name/graphql-status` queries `pg_extension`

---

## 🔗 Database Webhooks UI ✅

**Priority:** High  
**Effort:** Medium

### Description

Database Webhooks use `pg_net` to fire HTTP requests from Postgres triggers. The new `webhooks` tab provides full CRUD for these triggers without writing SQL.

### Key Features

- **Webhook List**: Table showing name, schema.table, events (INSERT/UPDATE/DELETE badges), URL, status
- **Create Modal**: Configure name, schema, table, events, HTTP method, endpoint URL, custom headers, timeout
- **Test Webhook**: Fires a test payload via `pg_net`
- **Delete Webhook**: `DROP TRIGGER IF EXISTS` on the selected table

### API Routes

```
GET    /api/instances/:name/webhooks
POST   /api/instances/:name/webhooks
DELETE /api/instances/:name/webhooks/:id
POST   /api/instances/:name/webhooks/:id/test
```

> Webhooks are stored as Postgres triggers directly in the tenant database — no Multibase schema changes needed.

---

## ⏰ Cron Job Manager ✅

**Priority:** High  
**Effort:** Medium

### Description

`pg_cron` is bundled with Supabase PostgreSQL. Jobs are stored in `cron.job`, run history in `cron.job_run_details`. The new `cron` tab provides a full UI for managing scheduled jobs — independent of the internal Multibase backup scheduler.

### Key Features

- **Job Table**: Name, schedule (cron syntax), command, last run, status, active toggle
- **Run History**: Expandable row showing last 10 executions with status and error messages
- **Create Modal**: Job name, cron schedule with helper dropdowns, SQL or HTTP command type
- **Run Now**: Immediately execute a job outside its schedule
- **Activate/Deactivate**: Toggle jobs without deleting them

### API Routes

```
GET    /api/instances/:name/cron
POST   /api/instances/:name/cron
DELETE /api/instances/:name/cron/:jobId
PATCH  /api/instances/:name/cron/:jobId
POST   /api/instances/:name/cron/:jobId/run
GET    /api/instances/:name/cron/:jobId/runs
```

---

## 🧠 AI & Vectors (pgvector) ✅

**Priority:** Very High  
**Effort:** Medium

### Description

`pgvector` enables Postgres as a vector database for AI embeddings and similarity search. The new `vectors` tab manages the extension, vector columns, indexes, and provides a live similarity search tester.

### Key Features

- **Extension Status Banner**: Shows if pgvector is enabled with a one-click activation button
- **Vector Columns**: List all `vector`-type columns with dimension and row count
- **Add Vector Column**: Modal to select table, column name, and dimension (1536=OpenAI, 768=Gemini, 384=small models)
- **Indexes**: List and create `ivfflat` / `hnsw` indexes
- **Similarity Search Tester**: Select table/column, enter query vector, choose distance metric (cosine/euclidean/inner product), view results with similarity scores
- **AI Agent Tools**: 4 new tools in `AiAgentService`: `vectorStatus`, `enableVector`, `createVectorColumn`, `searchVector`

### Supported Embedding Dimensions

| Model | Dimensions |
|-------|-----------|
| OpenAI `text-embedding-3-small` | 1536 |
| Google Gemini | 768 |
| Small local models | 384 |

---

## 📬 Message Queues (pgmq) ✅

**Priority:** Medium  
**Effort:** Medium

### Description

`pgmq` is a Postgres-native message queue extension. Queues are stored as regular Postgres tables. The new `queues` tab enables send, receive, acknowledge, and purge operations without leaving the dashboard.

### Key Features

- **Extension Status Banner**: One-click activation for `pgmq`
- **Queue List**: Queue name, message depth, oldest unprocessed message age
- **Queue Detail**: Message table (msg_id, enqueued_at, visibility timeout, read count, JSON payload)
- **Send Test Message**: Fire a message directly from the UI
- **Purge Queue**: Remove all messages from a queue
- **Create Queue**: Standard or Partitioned queue types

### API Routes

```
GET    /api/instances/:name/queues
POST   /api/instances/:name/queues
DELETE /api/instances/:name/queues/:queueName
GET    /api/instances/:name/queues/:queueName/messages
POST   /api/instances/:name/queues/:queueName/send
POST   /api/instances/:name/queues/:queueName/purge
GET    /api/instances/:name/queues/status
POST   /api/instances/:name/queues/enable
```

---

## 🗂️ SupabaseManager Tabs After v1.5

```
SupabaseManager (4 → 8 Tabs):
  1. Database       → Table Browser + SQL Editor    ✅ v1.0
  2. Storage        → File Manager                  ✅ v1.0
  3. RLS Policies   → Row-Level Security Editor     ✅ v1.0
  4. Functions      → Edge Functions                ✅ v1.0
  ─────────────────────────────────────────────────────
  5. Webhooks       → Database Webhooks UI          🆕 v1.5
  6. Cron Jobs      → pg_cron Manager               🆕 v1.5
  7. Vectors        → pgvector / AI Embeddings      🆕 v1.5
  8. Queues         → pgmq Message Queues           🆕 v1.5
```

> No new Prisma models — all features read/write directly into the tenant PostgreSQL database via SQL execution.
