# Installation Guide

Get Multibase running on your server in minutes with our automated installer.

## Quick Start

Copy and run this command on your server:

```bash
curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/main/deployment/install.sh | sudo bash
```

The interactive wizard will guide you through every step -- no manual configuration needed.

---

## Requirements

| Component  | Minimum                    |
| ---------- | -------------------------- |
| **OS**     | Ubuntu 22.04+ / Debian 12+ |
| **RAM**    | 1 GB (4 GB+ recommended)   |
| **Disk**   | 5 GB free space            |
| **Access** | Root or sudo privileges    |

> All dependencies like Node.js, Docker, Nginx, Python, PM2, and Certbot are **automatically installed** by the script. You don't need to install anything beforehand.

---

## Deployment Modes

The wizard offers three deployment modes depending on your infrastructure:

### Single Server (Recommended)

Everything runs on one server -- the simplest option for getting started.

- Frontend (static files served by Nginx)
- Backend API (Node.js via PM2)
- Docker (for Supabase instances)
- Redis (as Docker container)

### Split VPS -- Frontend Only

Use this when your **backend runs on a different server**. This server only hosts the static frontend and Nginx.

- Installs: Node.js, Nginx, Certbot
- Does **not** install: Docker, PM2, Python, Redis

### Split VPS -- Backend Only

Use this when your **frontend runs on a different server**. This server handles the API, Docker, and all Supabase instances.

- Installs: Node.js, Docker, Python, PM2, Nginx, Certbot, Redis
- Does **not** build or serve the frontend

> **Split VPS workflow:** Run the script on **each server separately**. Always install the **backend first**, then the frontend.

---

## The Wizard

The installer walks you through **6 interactive steps**:

### Step 1: Deployment Mode

Choose between Single Server, Split Frontend, or Split Backend.

### Step 2: Domains

Enter your frontend and backend domains. For split deployments, you'll enter the remote server's URL instead.

- **Single Server:** Frontend domain + Backend domain
- **Split Frontend:** Frontend domain + remote Backend URL
- **Split Backend:** Backend domain + remote Frontend URL

### Step 3: Admin Account

Set up the initial admin user with username, email, and password. If you skip the password, a secure one is auto-generated.

> This step is skipped for Frontend-Only installations.

### Step 4: SSL Certificate

Choose whether to set up free SSL via **Let's Encrypt**. Provide an email address for certificate notifications.

### Step 5: Additional Options

- **UFW Firewall** -- automatically opens ports 22, 80, and 443
- **Swap File** -- creates a 2 GB swap file if your server has less than 4 GB RAM

### Step 6: Confirmation

Review your choices in a summary before the installation begins.

---

## What Gets Installed

### Dependencies by Mode

| Package              | Single Server | Frontend Only | Backend Only |
| -------------------- | :-----------: | :-----------: | :----------: |
| **Node.js 20**       |      ✅       |      ✅       |      ✅      |
| **Docker + Compose** |      ✅       |       —       |      ✅      |
| **Python 3 + pip**   |      ✅       |       —       |      ✅      |
| **Nginx**            |      ✅       |      ✅       |      ✅      |
| **Certbot**          |      ✅       |      ✅       |      ✅      |
| **PM2**              |      ✅       |       —       |      ✅      |

The script checks each package before installing. Already-installed packages are skipped with an `[OK]` status.

### Generated Configuration Files

The wizard automatically creates all config files based on your answers:

- **Backend `.env`** -- Server port, database path, Redis URL, CORS origin, session secret, and all paths
- **Frontend `.env`** -- The `VITE_API_URL` pointing to your backend domain
- **Nginx Frontend Vhost** -- Serves static files, proxies `/api` and `/socket.io` to the backend
- **Nginx Backend Vhost** -- Reverse proxy to port 3001 with WebSocket support and 100 MB upload limit
- **PM2 Ecosystem** -- Process config with auto-restart, memory limit, and log rotation

### Directory Structure

After installation, your server will have this layout:

```
/opt/multibase/
├── dashboard/
│   ├── backend/           # Node.js API server
│   │   ├── data/          # SQLite database
│   │   └── .env           # Backend configuration
│   └── frontend/
│       ├── dist/          # Built static files
│       └── .env           # Frontend configuration
├── projects/              # Supabase instance data
├── backups/               # Backup storage
├── logs/                  # PM2 log files
├── venv/                  # Python virtual environment
├── nginx/
│   └── sites-enabled/     # Dynamic instance Nginx configs
└── ecosystem.config.js    # PM2 process configuration
```

---

## DNS Setup

After installation, configure your DNS provider with these records:

| Record                  | Type | Value          |
| ----------------------- | ---- | -------------- |
| `dashboard.example.com` | A    | Your server IP |
| `api.example.com`       | A    | Your server IP |
| `*.api.example.com`     | A    | Your server IP |

> **Important:** The wildcard record (`*`) is required for Supabase instance subdomains. Without it, your instances won't be accessible via their subdomain URLs.

---

## Updating

To update an existing installation to the latest version:

```bash
sudo /opt/multibase/deployment/install.sh --update
```

This will:

1. Pull the latest code from the repository
2. Rebuild the backend (dependencies + TypeScript compilation)
3. Run database migrations via Prisma
4. Rebuild the frontend
5. Restart PM2 and reload Nginx

---

## Uninstalling

See the dedicated [Uninstall Guide](/setup/getting-started/uninstall) for full details.

Quick reference:

```bash
# Standard removal
sudo bash /opt/multibase/deployment/uninstall.sh

# Keep project data
sudo bash /opt/multibase/deployment/uninstall.sh --keep-data

# Remove everything including system packages
sudo bash /opt/multibase/deployment/uninstall.sh --del-all
```

---

## Useful Commands

```bash
# Check if the backend is running
pm2 status

# View live backend logs
pm2 logs multibase-backend

# Test Nginx configuration for errors
sudo nginx -t

# Reload Nginx after config changes
sudo systemctl reload nginx

# View the installation log
cat /var/log/multibase-install.log
```

---

## Troubleshooting

### Backend won't start

Check the PM2 logs for error details:

```bash
pm2 logs multibase-backend --lines 50
```

### Nginx shows errors

Test the configuration to find the issue:

```bash
sudo nginx -t
```

### SSL certificate problems

Check existing certificates and test renewal:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### Redis container not running

Check if the container exists and view its logs:

```bash
docker ps -a | grep multibase-redis
docker logs multibase-redis
```

### WebSocket / real-time not working

Make sure the `/socket.io` proxy block in your frontend Nginx vhost includes `proxy_read_timeout 3600s` for long-lived connections.

### Frontend shows blank page

The `VITE_API_URL` in the frontend `.env` might be wrong. Fix it and rebuild:

```bash
cd /opt/multibase/dashboard/frontend
cat .env   # Check the current value
sudo -u multibase npm run build
```
