# Multibase System Checker

Interaktive Test-Webapp zum Überprüfen aller Kernfunktionen des Multibase-Systems.

## Was wird getestet?

| Bereich             | Tests   | Beschreibung                                                                            |
| ------------------- | ------- | --------------------------------------------------------------------------------------- |
| **MCP Connection**  | 5 Tests | Server Info, Tool Listing, Tool Calls (list_instances, get_instance), System Overview   |
| **Database (CRUD)** | 6 Tests | Tabelle erstellen → Insert → Read → Update → Delete → Cleanup                           |
| **Storage**         | 6 Tests | Bucket erstellen → Datei hochladen → Auflisten → Download+Verify → Public URL → Cleanup |
| **Edge Functions**  | 3 Tests | Functions auflisten, Function aufrufen (main), Logs abrufen                             |
| **Realtime**        | 4 Tests | Config abrufen, Stats abrufen, Subscribe+Broadcast Test, Connection Info                |

## Voraussetzungen

- **Node.js 20+**
- **Multibase Dashboard** läuft auf `http://localhost:3001`
- Mindestens eine Supabase-Instanz (z.B. `dein-project`) ist gestartet

## Setup

### 1. Dependencies installieren

```bash
cd Testprojekt
npm run install:all
```

### 2. Backend konfigurieren

```bash
cp backend/.env.example backend/.env
```

Dann die `.env` Datei anpassen:

```env
# Multibase Dashboard API
MULTIBASE_API_URL=http://localhost:3001
MULTIBASE_TOKEN=dein-dashboard-auth-token

# Welche Instanz soll getestet werden?
INSTANCE_NAME=dein-project

# Direkter Zugang zur Supabase-Instanz (aus der Projekt-.env)
SUPABASE_URL=http://localhost:4645
SUPABASE_ANON_KEY=dein-anon-key
SUPABASE_SERVICE_KEY=dein-service-role-key
```

Die Werte für `SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_KEY` findest du in
`projects/dein-project/.env` unter `API_EXTERNAL_URL`, `ANON_KEY` und `SERVICE_ROLE_KEY`.

### 3. Starten

```bash
# Beides gleichzeitig (Frontend + Backend)
npm run dev

# Oder einzeln:
npm run dev:backend   # Backend auf Port 3002
npm run dev:frontend  # Frontend auf Port 5173
```

### 4. Browser öffnen

```
http://localhost:5173
```

## Architektur

```
Testprojekt/
├── frontend/           # React 19 + Vite + Radix UI Themes
│   └── src/
│       ├── App.tsx             # Haupt-Layout
│       ├── components/
│       │   ├── TestPanel.tsx   # Wiederverwendbares Test-Panel
│       │   ├── McpTests.tsx    # MCP-Verbindungstests
│       │   ├── DatabaseTests.tsx
│       │   ├── StorageTests.tsx
│       │   ├── EdgeFunctionTests.tsx
│       │   └── RealtimeTests.tsx
│       └── lib/api.ts          # API-Client (Proxy zu Backend)
├── backend/            # Node.js + Express + TypeScript
│   └── src/
│       ├── index.ts            # Express Server (Port 3002)
│       ├── routes/
│       │   ├── mcp.ts          # MCP JSON-RPC Tests
│       │   ├── database.ts     # Supabase DB CRUD
│       │   ├── storage.ts      # Supabase Storage Ops
│       │   ├── functions.ts    # Edge Function Invoke
│       │   └── realtime.ts     # Realtime Subscribe/Broadcast
│       └── lib/
│           ├── multibaseClient.ts  # Axios → Multibase Dashboard API
│           └── supabaseClient.ts   # @supabase/supabase-js → Instanz
└── package.json        # Root mit concurrently
```

## Ports

| Service                         | Port |
| ------------------------------- | ---- |
| Frontend (Vite)                 | 5173 |
| Backend (Express)               | 3002 |
| Multibase Dashboard             | 3001 |
| Supabase Instanz (dein-project) | 4645 |

## Troubleshooting

**Backend Offline?**

- Prüfe ob `MULTIBASE_TOKEN` in `.env` gesetzt ist (Login im Dashboard → Token kopieren)
- Prüfe ob das Multibase Dashboard auf Port 3001 läuft

**Database Tests schlagen fehl?**

- Prüfe ob die Supabase-Instanz läuft: `docker ps | grep dein-project`
- Prüfe `SUPABASE_URL` und `SUPABASE_SERVICE_KEY` in `.env`

**Storage Tests schlagen fehl?**

- Storage-Service muss laufen: `docker ps | grep storage`
- Service-Key (nicht Anon-Key) wird für Bucket-Erstellung benötigt

**Realtime Subscribe-Test Timeout?**

- Realtime-Container muss laufen: `docker ps | grep realtime`
- Prüfe ob der Tenant korrekt konfiguriert ist (siehe `docs/REALTIME_CONFIG.md`)
