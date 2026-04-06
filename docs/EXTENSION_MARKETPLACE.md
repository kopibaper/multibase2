# Extension Marketplace — Technical Reference

## Overview

The Extension Marketplace allows one-click installation of pre-built SQL schemas, Edge Functions, and configuration templates onto any managed Supabase instance.

**51 official extensions** across 6 categories are included out of the box and are automatically synced to the database on server startup.

---

## How It Works

### Installation Flow

1. User opens Marketplace, selects an extension, clicks **Install**
2. Frontend opens a 5-step wizard: Details → Instance → Config → Progress → Done
3. Backend receives `POST /api/instances/:name/extensions`
4. `ExtensionService` fetches `manifest.json` from `localhost:3001/extensions/{id}/manifest.json`
5. Config values are interpolated into SQL (`{{schemaName}}` → `public`)
6. SQL is executed directly on the Postgres instance via `instanceManager.executeSQL()`
7. `InstalledExtension` record is created with status `active`

### Manifest URL Resolution

All manifests are served locally by the same Express process:

```
GET localhost:3001/extensions/ecommerce-starter/manifest.json
GET localhost:3001/extensions/ecommerce-starter/schema.sql
```

The static server is registered in `server.ts`:

```ts
app.use('/extensions', express.static(path.join(__dirname, '../extensions')));
```

---

## manifest.json Reference

```json
{
  "id": "extension-id",
  "version": "1.0.0",
  "requirements": {
    "postgresExtensions": ["uuid-ossp", "pgvector"]
  },
  "install": {
    "type": "sql",
    "steps": [
      { "label": "Create tables",   "file": "schema.sql" },
      { "label": "Deploy function", "file": "index.ts", "functionName": "my-fn" }
    ],
    "rollback": "rollback.sql"
  }
}
```

| Field | Description |
|-------|-------------|
| `type` | `sql` · `config` · `function` · `composite` |
| `steps[].file` | Path relative to manifest base URL |
| `steps[].functionName` | Required for function-type steps |
| `steps[].envVars` | Key/value map for config-type steps |
| `steps[].optional` | If `true`, can be skipped via config |
| `rollback` | SQL file executed on uninstall |

---

## Config Interpolation

Any `{{key}}` pattern in SQL files is replaced with the corresponding config value from the install wizard:

```sql
-- schema.sql
CREATE SCHEMA IF NOT EXISTS {{schemaName}};
CREATE TABLE {{schemaName}}.products (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);
```

If a value is missing, it is replaced with an empty string.

---

## Install Types

### `sql`
Fetches and executes SQL files on the Postgres instance. Used for schema creation, tables, RLS policies.

### `config`
Sets environment variables on the instance via `instanceManager.updateInstanceEnv()`. No SQL is run. Used for OAuth providers, API keys.

### `function`
Deploys TypeScript code as an Edge Function via `FunctionService`. Requires `functionName` on the step.

### `composite`
Same as `sql` — runs SQL files. Semantically indicates that the extension combines multiple concerns. Function and config steps in a composite manifest require separate step configuration.

---

## Security

| Measure | Implementation |
|---------|----------------|
| SQL injection prevention | Blocked patterns: `DROP DATABASE`, `DROP ROLE`, `CREATE ROLE`, `ALTER SYSTEM`, `COPY TO/FROM` |
| SSRF prevention | Manifest URLs validated against allow-list: `localhost`, `127.0.0.1`, `cdn.multibase.dev` |
| Rate limiting | Max 3 installs per instance per hour |
| Audit logging | Every install/uninstall logged with userId, IP, user-agent |
| Postgres extension sanitization | Extension names validated against `[\w-]+` |

---

## Auto-Sync on Startup

`server.ts` calls `seedMarketplace()` on every startup, which upserts all 51 extensions from `src/data/marketplace-extensions.ts`. New extensions added to the data file appear automatically after restart — no manual migration needed.

```ts
// server.ts — called in start() after createInitialAdmin()
await seedMarketplace();
```

---

## API Endpoints

### Marketplace Catalog

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/marketplace/extensions` | List all extensions (filter: `category`, `search`, `featured`) |
| `GET` | `/api/marketplace/extensions/:id` | Get single extension |
| `GET` | `/api/marketplace/extensions/:id/reviews` | List reviews |
| `POST` | `/api/marketplace/extensions/:id/reviews` | Submit rating/review |
| `GET` | `/api/marketplace/extensions/:id/stats` | Install count + rating |

### Instance Extensions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/instances/:name/extensions` | List installed extensions |
| `POST` | `/api/instances/:name/extensions` | Install extension |
| `DELETE` | `/api/instances/:name/extensions/:id` | Uninstall extension |
| `GET` | `/api/instances/:name/extensions/:id/status` | Check install status |

---

## Directory Structure

```
dashboard/backend/
├── src/
│   ├── data/
│   │   └── marketplace-extensions.ts   ← 51 extension definitions (seed data)
│   ├── routes/
│   │   ├── marketplace.ts              ← catalog API
│   │   └── extensions.ts              ← install/uninstall API
│   └── services/
│       ├── ExtensionService.ts         ← core install logic
│       └── ExtensionUpdateChecker.ts  ← background update checker
└── extensions/                        ← static manifest + SQL files
    ├── ecommerce-starter/
    │   ├── manifest.json
    │   ├── schema.sql
    │   └── rollback.sql
    ├── stripe-webhooks/
    │   ├── manifest.json
    │   ├── schema.sql
    │   ├── rollback.sql
    │   └── index.ts
    └── ...                            ← 49 more extensions

dashboard/frontend/src/
├── pages/
│   └── MarketplacePage.tsx            ← browse + filter UI
└── components/marketplace/
    ├── ExtensionCard.tsx              ← card component
    ├── ExtensionDetailModal.tsx       ← install wizard
    └── ExtensionsTab.tsx             ← installed extensions per instance
```

---

## Adding a New Extension

1. Add entry to `src/data/marketplace-extensions.ts`
2. Create directory `backend/extensions/{id}/`
3. Create `manifest.json`, `schema.sql`, `rollback.sql` (and `index.ts` for functions)
4. Restart backend — extension is automatically synced to DB

No code changes required beyond the data file and the extension directory.
