# Multibase System Checker

Interactive test web app to verify all core functions of the Multibase system.

## What is tested?

| Area                | Tests   | Description                                                                             |
| ------------------- | ------- | --------------------------------------------------------------------------------------- |
| **MCP Connection**  | 5 Tests | Server Info, Tool Listing, Tool Calls (list_instances, get_instance), System Overview   |
| **Database (CRUD)** | 6 Tests | Create table → Insert → Read → Update → Delete → Cleanup                                |
| **Storage**         | 6 Tests | Create bucket → Upload file → List → Download+Verify → Public URL → Cleanup             |
| **Edge Functions**  | 3 Tests | List functions, invoke function (main), fetch logs                                      |
| **Realtime**        | 4 Tests | Fetch config, fetch stats, Subscribe+Broadcast test, Connection info                    |

## Requirements

- **Node.js 20+**
- **Multibase Dashboard** running at `http://localhost:3001`
- At least one Supabase instance (e.g. `your-project`) is started

## Setup

### 1. Install dependencies

```bash
cd Testprojekt
npm run install:all
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Then edit the `.env` file:

```env
# Multibase Dashboard API
MULTIBASE_API_URL=http://localhost:3001
MULTIBASE_TOKEN=your-dashboard-auth-token

# Which instance should be tested?
INSTANCE_NAME=your-project

# Test Server Port
PORT=3002

# NOTE: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY are NO LONGER NEEDED.
# The backend fetches them automatically from the Multibase API at startup.
# Connection uses http://localhost:{gateway_port} directly (bypasses nginx auth_request).
```

You can find your `MULTIBASE_TOKEN` in the Dashboard under **Settings → API Keys**.
The `INSTANCE_NAME` must match an existing project in your `projects/` directory.

### 3. Start

```bash
# Both at once (Frontend + Backend)
npm run dev

# Or individually:
npm run dev:backend   # Backend on port 3002
npm run dev:frontend  # Frontend on port 5173
```

### 4. Open in browser

```
http://localhost:5173
```

## Architecture

```
Testprojekt/
├── frontend/           # React 19 + Vite + Radix UI Themes
│   └── src/
│       ├── App.tsx             # Main layout
│       ├── components/
│       │   ├── TestPanel.tsx   # Reusable test panel
│       │   ├── McpTests.tsx    # MCP connection tests
│       │   ├── DatabaseTests.tsx
│       │   ├── StorageTests.tsx
│       │   ├── EdgeFunctionTests.tsx
│       │   └── RealtimeTests.tsx
│       └── lib/api.ts          # API client (proxy to backend)
├── backend/            # Node.js + Express + TypeScript
│   └── src/
│       ├── index.ts            # Express Server (Port 3002)
│       ├── routes/
│       │   ├── mcp.ts          # MCP JSON-RPC tests
│       │   ├── database.ts     # Supabase DB CRUD
│       │   ├── storage.ts      # Supabase Storage operations
│       │   ├── functions.ts    # Edge Function invoke
│       │   └── realtime.ts     # Realtime Subscribe/Broadcast
│       └── lib/
│           ├── multibaseClient.ts  # Axios → Multibase Dashboard API
│           └── supabaseClient.ts   # @supabase/supabase-js → Instance
└── package.json        # Root with concurrently
```

## Ports

| Service                             | Port |
| ----------------------------------- | ---- |
| Frontend (Vite)                     | 5173 |
| Backend (Express)                   | 3002 |
| Multibase Dashboard                 | 3001 |
| Supabase Instance (your-project)    | 4645 |

## Troubleshooting

**Backend offline?**

- Make sure `MULTIBASE_TOKEN` is set in `.env` (log in to the Dashboard → copy the token)
- Make sure the Multibase Dashboard is running on port 3001

**Database tests failing?**

- Check if the Supabase instance is running: `docker ps | grep your-project`
- Verify `MULTIBASE_TOKEN` and `INSTANCE_NAME` in `.env`

**Storage tests failing?**

- The storage service must be running: `docker ps | grep storage`
- A service key (not the anon key) is required for bucket creation

**Realtime subscribe test timeout?**

- The realtime container must be running: `docker ps | grep realtime`
- Check that the tenant is correctly configured (see `docs/REALTIME_CONFIG.md`)
