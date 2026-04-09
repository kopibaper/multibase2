# Scripts Reference

This page covers all operational scripts included with Multibase. The old dev-only shell scripts (`launch.sh`, `stop.sh`, `status.sh`) have been superseded by **PM2** (production) and `npm run dev` (local development).

> For PM2 management see [PM2 Configuration](/setup/configuration/pm2).  
> For initial server setup see [Single Server Deployment](/setup/deployment/single-server).

---

## 🏗️ setup_shared.py

**Location:** `setup_shared.py` (project root)  
**Purpose:** Initialise and manage the Shared Infrastructure stack (PostgreSQL, Studio, Analytics, Vector, imgproxy, Pooler, Meta, Nginx Gateway).

### Commands

```bash
# First-time setup — generates secrets, writes .env.shared, starts the stack
python setup_shared.py init

# Force reinitialise (overwrites existing config)
python setup_shared.py init --force

# Start the shared stack
python setup_shared.py start

# Stop the shared stack
python setup_shared.py stop

# Show status of all 8 shared services
python setup_shared.py status

# Create a new tenant database in the shared PostgreSQL
python setup_shared.py create-db <project-name>

# Drop a tenant database
python setup_shared.py drop-db <project-name>

# List all tenant databases
python setup_shared.py list-dbs
```

### What `init` does

1. Generates secure random secrets (JWT, DB passwords, API keys)
2. Writes `shared/.env.shared` with all generated values
3. Starts the Docker Compose shared stack (`shared/docker-compose.shared.yml`)
4. Provisions shared services (Nginx gateway config, Vector config, etc.)

---

## 🐍 supabase_manager.py

**Location:** `supabase_manager.py` (project root)  
**Purpose:** CLI for managing individual tenant projects (lightweight Supabase instances that use the shared infrastructure).

> This script is also called internally by the Node.js backend when creating/deleting projects via the Dashboard UI.

### Shared Infrastructure Commands

```bash
# Start shared stack
python supabase_manager.py shared-start

# Stop shared stack
python supabase_manager.py shared-stop

# Show shared infrastructure status
python supabase_manager.py shared-status
```

### Tenant Project Commands

```bash
# Create a new tenant project (auto-assigns ports)
python supabase_manager.py create <project-name>

# Create with specific base port
python supabase_manager.py create <project-name> --base-port 8100

# Start a project
python supabase_manager.py start <project-name>

# Start with verbose output
python supabase_manager.py start <project-name> --verbose

# Stop a project
python supabase_manager.py stop <project-name>

# Stop but keep volumes (data preserved)
python supabase_manager.py stop <project-name> --keep-volumes

# Reset a project (recreates containers, keeps data)
python supabase_manager.py reset <project-name>

# Check status of a project
python supabase_manager.py status <project-name>

# List all tenant projects
python supabase_manager.py list
```

### Port Assignment

Projects are assigned a block of ports starting from `8000` (incrementing by 10). The `--base-port` flag overrides auto-assignment. Port registry is derived by scanning `projects/*/  .env` at runtime.

---

## 🚀 deployment/install.sh

**Location:** `deployment/install.sh`  
**Purpose:** Fully automated production installation on a fresh Ubuntu/Debian VPS. Run once as root.

```bash
# Remote one-liner (recommended)
curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/main/deployment/install.sh | sudo bash

# Or clone first and run locally
sudo bash deployment/install.sh
```

**What it does:**
- Installs Node.js, Docker, PM2, Nginx, Certbot
- Clones the repository to `/opt/multibase`
- Runs `npm install` + `npm run build` for backend and frontend
- Configures Nginx to serve the frontend and proxy the API
- Starts Redis as a Docker container
- Starts the backend via PM2 with auto-restart on reboot
- Runs an interactive wizard for domain, SSL, and admin account setup

---

## 🗑️ deployment/uninstall.sh

**Location:** `deployment/uninstall.sh`  
**Purpose:** Completely removes Multibase from a server.

```bash
sudo bash deployment/uninstall.sh
```

Removes the PM2 process, Nginx config, Redis container, and optionally the `/opt/multibase` directory.

---

## 🩹 shared/studio-patches/apply-patches.sh

**Location:** `shared/studio-patches/apply-patches.sh`  
**Purpose:** Applies patches to the Supabase Studio container to enable multi-tenant support (custom API URL per tenant).

```bash
bash shared/studio-patches/apply-patches.sh
```

This runs automatically during `setup_shared.py init` and after shared stack updates.

---

## 🛠️ Common Maintenance Commands

### Backend (PM2)

```bash
pm2 list                          # Show all processes
pm2 logs multibase-backend        # Tail live logs
pm2 restart multibase-backend     # Restart backend
pm2 reload multibase-backend      # Zero-downtime reload
pm2 status                        # Health overview
```

### Shared Stack (Docker Compose)

```bash
# Start/stop shared services
docker compose -f shared/docker-compose.shared.yml \
  --env-file shared/.env.shared \
  --project-name multibase-shared up -d

docker compose -f shared/docker-compose.shared.yml \
  --env-file shared/.env.shared \
  --project-name multibase-shared down

# View logs for a specific service
docker logs multibase-nginx-gateway --tail 50 -f
docker logs multibase-db --tail 50 -f
```

### Database (Prisma)

```bash
cd dashboard/backend

# Apply pending migrations
npx prisma migrate deploy

# Open Prisma Studio (local DB browser)
npx prisma studio

# Reset DB (development only!)
npx prisma migrate reset
```

### Local Development

```bash
# Terminal 1 — Backend
cd dashboard/backend
npm run dev

# Terminal 2 — Frontend
cd dashboard/frontend
npm run dev
```
**Purpose**: Start all services in the correct order with health checks and validation.

**Usage**:
```bash
./launch.sh [OPTIONS]
```

**Options**:
- `--skip-redis`: Don't start/check Redis container (assume it's already running)
- `--force-ports`: Automatically kill processes using required ports
- `--production`: Build and run production versions (compiled)
- `--build`: Force rebuild before starting
- `--help`: Show help message

**What it does**:
1. ✅ Pre-flight checks (Node.js, Docker, npm)
2. ✅ Verify/install dependencies (node_modules, Prisma)
3. ✅ Start Redis container (if not running)
4. ✅ Start backend API (port 3001)
5. ✅ Wait for backend health check
6. ✅ Start frontend dev server (port 5173)
7. ✅ Wait for frontend readiness
8. ✅ Display status and access URLs

**PID Management**:
- Stores PIDs in `.pids/backend.pid` and `.pids/frontend.pid`
- Enables reliable process tracking for shutdown

---

### 🛑 stop.sh
**Purpose**: Gracefully shutdown all services with proper cleanup.

**Usage**:
```bash
./stop.sh [OPTIONS]
```

**Options**:
- `--force`: Use SIGKILL immediately (no graceful shutdown)
- `--stop-redis`: Also stop the Redis container
- `--cleanup-redis`: Stop and remove Redis container
- `--help`: Show help message

**What it does**:
1. ✅ Find processes via PID files (fallback to port/name search)
2. ✅ Send SIGTERM to frontend (5s graceful timeout)
3. ✅ Send SIGTERM to backend (10s graceful timeout with built-in handlers)
4. ✅ Force SIGKILL if processes don't stop
5. ✅ Optionally stop/remove Redis container
6. ✅ Clean up PID files
7. ✅ Verify ports are freed
8. ✅ Check for orphaned processes

**Graceful Shutdown**:
- Frontend: 5 second timeout
- Backend: 10 second timeout (backend has built-in graceful shutdown)
- Automatic SIGKILL fallback if needed

---

### 📊 status.sh
**Purpose**: Quick status overview of all services.

**Usage**:
```bash
./status.sh
```

**What it shows**:
- ✅ Service status (Redis, Backend, Frontend)
- ✅ Process IDs and ports
- ✅ Backend health check results
- ✅ Port usage (in use vs available)
- ✅ Supabase instance summary (count, health)
- ✅ Individual instance details
- ✅ Access URLs
- ✅ Useful commands

**No options needed** - just run it anytime to see current status.

---

## Common Workflows

### First Time Setup
```bash
# Start everything from scratch
./launch.sh

# Check status
./status.sh
```

### Daily Development
```bash
# Start services
./launch.sh --skip-redis

# Work on your code...

# Check status anytime
./status.sh

# Stop services when done
./stop.sh
```

### Handling Port Conflicts
```bash
# If ports are already in use
./launch.sh --force-ports

# Or manually stop first
./stop.sh --force
./launch.sh
```

### Production Deployment
```bash
# Build and run production versions
./launch.sh --production --build

# Stop everything including Redis
./stop.sh --stop-redis
```

### Clean Restart
```bash
# Force stop everything
./stop.sh --force

# Start fresh
./launch.sh --force-ports
```

### Full Cleanup
```bash
# Stop and remove everything
./stop.sh --cleanup-redis --force

# Start from scratch
./launch.sh
```

---

## Service Dependencies

```
Redis Container (port 6379)
    ↓ required by
Backend API (port 3001)
    ↓ proxied by
Frontend Dev Server (port 5173)
```

**Startup Order**:
1. Redis (first)
2. Backend (waits for Redis)
3. Frontend (waits for Backend)

**Shutdown Order**:
1. Frontend (first)
2. Backend (graceful shutdown with 10s timeout)
3. Redis (optional, only with `--stop-redis`)

---

## Health Checks

### Backend Health
```bash
curl http://localhost:3001/api/ping
# Expected: {"status":"ok","services":{"docker":true,"redis":true}}
```

### Frontend Health
```bash
curl http://localhost:5173/
# Expected: HTML page with <!DOCTYPE html>
```

### Redis Health
```bash
docker ps --filter "name=multibase-redis"
redis-cli -h localhost -p 6379 ping
# Expected: PONG
```

---

## Troubleshooting

### Services Won't Start

**Check logs**:
```bash
# Backend logs
tail -f backend/logs/backend.log

# Frontend logs
tail -f frontend/logs/frontend.log
```

**Check ports**:
```bash
# See what's using ports
ss -tlnp | grep -E ":(3001|5173|6379)"
```

**Force clean restart**:
```bash
./stop.sh --force
./launch.sh --force-ports
```

### PID Files Out of Sync

If services are running but scripts can't find them:

```bash
# Remove stale PID files
rm -rf .pids/*.pid

# Stop will now search by port/name
./stop.sh

# Start fresh
./launch.sh
```

### Port Already in Use

**Option 1: Use force flag**
```bash
./launch.sh --force-ports
```

**Option 2: Manual cleanup**
```bash
# Find process on port 3001
fuser 3001/tcp

# Kill it
fuser -k 3001/tcp
```

### Redis Container Issues

**Check container status**:
```bash
docker ps -a --filter "name=multibase-redis"
```

**Restart Redis**:
```bash
docker restart multibase-redis
```

**Remove and recreate**:
```bash
./stop.sh --cleanup-redis
./launch.sh
```

### Orphaned Processes

**Find dashboard processes**:
```bash
pgrep -af "tsx|vite|node.*server"
```

**Kill all**:
```bash
pkill -f "tsx.*server.ts"
pkill -f "vite.*dev"
```

---

## Directory Structure

```
dashboard/
├── launch.sh           # Start script
├── stop.sh             # Stop script
├── status.sh           # Status check script
├── .pids/              # PID files directory
│   ├── backend.pid     # Backend process ID
│   └── frontend.pid    # Frontend process ID
├── backend/
│   └── logs/
│       ├── backend.log     # Backend output
│       ├── combined.log    # Winston logs
│       └── error.log       # Winston errors
└── frontend/
    └── logs/
        └── frontend.log    # Frontend output
```

---

## Script Features

### ✅ Implemented Features

**launch.sh**:
- Pre-flight system checks
- Dependency validation
- Automatic dependency installation
- Redis container management
- Port conflict detection
- Graceful port cleanup (with --force-ports)
- Health check polling
- PID tracking
- Color-coded status output
- Production build support
- Comprehensive error handling

**stop.sh**:
- PID file-based process discovery
- Fallback to port/name-based discovery
- Graceful SIGTERM shutdown
- Configurable timeouts
- Force SIGKILL fallback
- Redis container management
- Port cleanup verification
- Orphaned process detection
- Clean PID file removal
- Status summary

**status.sh**:
- Real-time service status
- Process information
- API health checks
- Port usage display
- Instance count and health
- Detailed instance list
- Access URLs
- Quick command reference

---

## Exit Codes

**launch.sh**:
- `0`: Success - all services started
- `1`: Failure - check error output

**stop.sh**:
- `0`: Success - all services stopped
- Non-zero values indicate partial failures

**status.sh**:
- `0`: Always (information only)

---

## Environment Requirements

- **Node.js**: 20+ (checked by launch.sh)
- **Docker**: Running daemon (checked)
- **npm**: Available (checked)
- **Redis**: Optional (can skip with --skip-redis)
- **Ports**: 3001, 5173, 6379 (checked and cleaned if needed)

---

## Best Practices

1. **Always check status first**:
   ```bash
   ./status.sh
   ```

2. **Use --skip-redis during development**:
   ```bash
   ./launch.sh --skip-redis
   ```

3. **Check logs if services fail**:
   ```bash
   tail -f backend/logs/backend.log
   ```

4. **Clean shutdown before restart**:
   ```bash
   ./stop.sh && ./launch.sh
   ```

5. **Use --force-ports for quick restarts**:
   ```bash
   ./launch.sh --force-ports
   ```

---

## Access URLs

Once services are running:

- **Dashboard**: http://localhost:5173
- **API**: http://localhost:3001/api/ping
- **Nginx** (production): http://mission.smartpi.ai

---

## Support

For issues:
1. Check `./status.sh` output
2. Review logs in `backend/logs/` and `frontend/logs/`
3. Try `./stop.sh --force && ./launch.sh --force-ports`
4. Check Docker with `docker ps -a`

---

**Built for Multibase Dashboard** - Comprehensive Supabase Instance Management
