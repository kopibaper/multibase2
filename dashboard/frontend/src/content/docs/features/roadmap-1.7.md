# Version 1.7 — Scale & Ecosystem
description: Edge Functions IDE, Read Replicas, Log Drains, Realtime Dashboard, MCP Server

**Status:** ✅ Released  
**Release:** March 2026  
**Use Case:** Production scale tooling, observability, and AI assistant integration

---

## 🎯 Overview

v1.7 brings **scale, observability, and ecosystem integrations** to Multibase. The Edge Functions editor gets a full IDE upgrade, database replication and log forwarding are first-class features, and Multibase exposes itself as an MCP server for AI assistants.

| # | Feature | Location | Priority |
|---|---------|----------|----------|
| 1 | Edge Functions IDE (CodeMirror + Test-Runner) | `FunctionsTab.tsx` upgrade | High |
| 2 | Read Replicas (PostgreSQL Streaming Replication UI) | New tab `replicas` | Medium |
| 3 | Log Drains (Webhook-based Log Export) | New tab `log-drains` | Medium |
| 4 | Realtime Dashboard (Channels, Presence, Stats) | New tab `realtime` | Medium |
| 5 | MCP Server (Model Context Protocol) | Global `/settings/mcp` page | Medium |

---

## 🏗️ Workspace Sidebar (v1.7)

```
/workspace/projects/:project/:tab
  Main tabs: overview | auth | database | storage | policies |
             functions | webhooks | cron | vectors | queues | api |
             realtime | replicas | log-drains
  ─── Configuration ───
  smtp | keys | domains | vault | security
```

**New tabs:** `realtime`, `replicas`, `log-drains` added to the main group after `api`.  
**MCP Server** lives on the global settings page `/settings/mcp`.

---

## 💻 Edge Functions IDE ✅

**Priority:** High  
**Effort:** Medium

### Description

The existing `FunctionsTab.tsx` used a plain `<textarea>`. v1.7 upgrades it to a full **CodeMirror 6** editor with TypeScript syntax highlighting, keyboard shortcuts, per-function environment variables, and an integrated test runner.

### Key Features

- **CodeMirror 6 Editor**: TypeScript/JavaScript syntax highlighting with One Dark theme
- **Keyboard Shortcut**: `Ctrl+S` / `Cmd+S` saves immediately
- **Dirty State Indicator**: Visual feedback when unsaved changes exist
- **Function Env Vars**: Expandable section below the editor to manage per-function `.env` files (key-value table with add/delete rows)
- **Test Runner Panel**: Select HTTP method, set headers and body, invoke the function, view status badge and formatted JSON response

### New Backend Routes

```
GET  /api/instances/:name/functions/:funcName/env
PUT  /api/instances/:name/functions/:funcName/env
POST /api/instances/:name/functions/:funcName/invoke
```

> `@uiw/react-codemirror` and `@codemirror/theme-one-dark` were already installed. Only `@codemirror/lang-javascript` is newly added.

---

## 🔁 Read Replicas ✅

**Priority:** Medium  
**Effort:** Medium

### Description

Register and monitor external PostgreSQL Read Replicas per instance. The Replicas tab shows replication status, lag (bytes/seconds), and supports connection testing.

### Key Features

- **Replica Registration**: Add a replica by name and `postgresql://` URL
- **Status Check**: Connects to the replica, queries `pg_is_in_recovery()` and lag from `pg_stat_replication`
- **Status Badges**: `ok` (green), `lagging` (yellow), `error` (red), `unknown` (grey)
- **Connection Masking**: URL displayed as `postgresql://***@host:port/db` — credentials never exposed to frontend
- **Delete Replica**: With confirmation

### New Prisma Model

```prisma
model ReadReplica {
  id         String   @id @default(uuid())
  instanceId String
  name       String
  url        String
  status     String   @default("unknown")
  lagBytes   Int?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  instance   Instance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
}
```

### API Routes

```
GET    /api/instances/:name/replicas
POST   /api/instances/:name/replicas
GET    /api/instances/:name/replicas/:id/status
DELETE /api/instances/:name/replicas/:id
```

---

## 📤 Log Drains ✅

**Priority:** Medium  
**Effort:** Medium

### Description

Log Drains forward container logs from a Multibase instance to external HTTP webhook endpoints (e.g. Datadog, Logtail, custom log servers). The backend polls every 30 seconds and delivers batched log lines.

### Key Features

- **Multiple Drains per Instance**: Up to 3 log drains
- **Service Filtering**: Select which services to forward (auth, rest, db, realtime, storage, functions)
- **Format**: JSON or NDJSON
- **Delivery Status**: Last HTTP status code with color (2xx green, 4xx/5xx red)
- **Test Delivery**: Send 5 demo log lines to verify the endpoint
- **Enable/Disable Toggle**: Pause a drain without deleting it

### Delivery Payload

```json
{
  "source": "multibase",
  "instance": "my-project",
  "drain": "my-drain",
  "lines": [
    { "timestamp": "...", "service": "auth", "message": "..." }
  ]
}
```

### New Prisma Model

```prisma
model LogDrain {
  id           String    @id @default(uuid())
  instanceId   String
  name         String
  url          String
  services     String
  format       String    @default("json")
  enabled      Boolean   @default(true)
  lastStatus   Int?
  lastDelivery DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  instance     Instance  @relation(fields: [instanceId], references: [id], onDelete: Cascade)
}
```

> URL validation requires `https://` in production. The `since` timestamp prevents duplicate log delivery between polling cycles.

---

## 📡 Realtime Dashboard ✅

**Priority:** Medium  
**Effort:** Small

### Description

A dedicated `realtime` tab gives visibility into the Elixir/Phoenix Realtime service per instance: configuration, live stats, and a quick-connect code snippet.

### Key Features

- **Service Status**: Running/stopped badge with tenant ID
- **Configuration**: Max Concurrent Users input (10–10,000) with restart warning
- **Live Stats** (auto-refresh every 5s): Active Channels, CPU %, Memory MB
- **Quick Connect Snippet**: Pre-filled JavaScript `createClient()` example with the instance's API URL and Anon Key

### API Routes

```
GET   /api/instances/:name/realtime/config
PATCH /api/instances/:name/realtime/config
GET   /api/instances/:name/realtime/stats
```

> Changing `maxConcurrentUsers` triggers a container restart (~5s downtime).

---

## 🤖 MCP Server ✅

**Priority:** Medium  
**Effort:** Large

### Description

Multibase exposes itself as an **MCP (Model Context Protocol) server**, allowing AI assistants (Claude Desktop, Cursor, VS Code Copilot) to manage Multibase instances directly using natural language.

### MCP Tools

| Tool | Description |
|------|-------------|
| `list_instances` | List all instances with status |
| `get_instance` | Get details for a single instance |
| `start_instance` | Start a stopped instance |
| `stop_instance` | Stop a running instance |
| `restart_instance` | Restart instance or a specific service |
| `execute_sql` | Run a SQL query (SELECT/WITH/EXPLAIN only) |
| `get_logs` | Fetch container logs |
| `get_health` | Get health status |
| `get_metrics` | Get CPU/RAM metrics |
| `create_instance` | Create a new instance |
| `backup_instance` | Trigger a database backup |
| `list_functions` | List Edge Functions |

### Protocol

**MCP Streamable HTTP Transport** (`2025-03-26` spec):
- `POST /api/mcp` — JSON-RPC 2.0 requests
- `GET /api/mcp/info` — Server info and tool list (no auth required)
- **Auth**: `Authorization: Bearer <API_KEY>`

### Security

- `execute_sql` is restricted to **read-only** queries (SELECT, WITH, EXPLAIN) — write operations are blocked
- Sensitive values (JWT secrets, passwords) are **never** returned in tool responses
- The MCP endpoint is rate-limited to 100 requests/minute per API key
- All tool invocations require a valid API key

### Integration (Settings Page `/settings/mcp`)

The MCP settings page provides ready-to-copy configuration snippets for:

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "multibase": {
      "url": "https://<HOST>/api/mcp",
      "headers": { "Authorization": "Bearer <API_KEY>" }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`) and **VS Code** (`settings.json`) snippets are also provided with inline placeholder replacement.
