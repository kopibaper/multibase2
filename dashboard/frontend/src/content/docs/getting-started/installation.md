# Installation Guide

Get Multibase running on your server in minutes with our automated installer.

## Quick Start

Copy and run this command on your server:

```bash
curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/feature_roadmap/install.sh | sudo bash
```

The interactive wizard will guide you through every step — no manual configuration needed.

---

## Requirements

| Component  | Minimum                    |
| ---------- | -------------------------- |
| **OS**     | Ubuntu 22.04+ / Debian 12+ |
| **RAM**    | 1 GB (4 GB+ recommended)   |
| **Disk**   | 10 GB free space           |
| **Access** | Root or sudo privileges    |

> All dependencies like Node.js, Docker, Nginx, Python, PM2, and Certbot are **automatically installed** by the script. You don't need to install anything beforehand.

---

## Deployment Modes

The wizard offers three deployment modes depending on your infrastructure:

### Single Server (Recommended)

Everything runs on one server — the simplest option for getting started.

- Frontend (static files served by Nginx)
- Backend API (Node.js via PM2)
- Shared infrastructure (Docker: PostgreSQL, Studio, Supavisor, ...)
- Redis (Docker container)

**19 installation steps.**

### Split VPS — Frontend Only

Use this when your **backend runs on a different server**. This server only hosts the static frontend and Nginx.

- Installs: Node.js, Nginx, Certbot
- Does **not** install: Docker, PM2, Python, Redis

**9 installation steps.**

### Split VPS — Backend Only

Use this when your **frontend runs on a different server**. This server handles the API, Docker, and all Supabase instances.

- Installs: Node.js, Docker, Python, PM2, Nginx, Certbot, Redis
- Does **not** build or serve the frontend

**18 installation steps.**

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

Choose whether to set up a free SSL certificate via **Let's Encrypt** and select the certificate type:

| Type | How it works | When to use |
| --- | --- | --- |
| **Per-domain** *(recommended)* | Fully automatic — certbot proves ownership via HTTP challenge. No manual steps. | Works with any DNS provider |
| **Wildcard** | Covers `*.yourdomain.com`. Installer pauses and asks you to add a DNS TXT record at your provider before continuing. | Required when you want all subdomains under one cert |

> If you choose **Wildcard**, the installer will pause, display the TXT record value to add at your DNS provider, and wait for you to press Enter. Use `dig TXT _acme-challenge.yourdomain.com +short` in a second terminal to verify propagation before continuing.

### Step 5: Additional Options

- **UFW Firewall** — automatically opens ports 22, 80, and 443
- **Swap File** — creates a 2 GB swap file if your server has less than 4 GB RAM (auto-skipped if swap already exists or enough RAM is detected)

### Step 6: Confirmation

Review your settings in a summary before the installation begins. Type `n` to cancel without making any changes.

---

## Re-running the Installer

If you run the installer on a server that already has Multibase installed, it detects the previous configuration and offers a shortcut:

```text
------------------------------------------------------
  Previous installation detected
------------------------------------------------------

  Mode:    split-backend
  Domain:  backend.example.com
  Admin:   admin (you@example.com)
  SSL:     y  |  UFW: n

  [1] Use these settings and start installation directly
  [2] Edit settings (go through wizard with pre-filled defaults)

  Choice [1]:
```

Choose **[1]** to reinstall/update with the same settings instantly. Choose **[2]** to go through the wizard again with all previous values pre-filled.

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
| **Redis**            |      ✅       |       —       |      ✅      |

The script checks each package before installing. Already-installed packages are skipped with an `[OK]` status.

### Shared Infrastructure (Docker)

Backend and Single Server installations automatically start a **shared Docker stack** that all Supabase instances use:

| Container | Purpose |
| --- | --- |
| `multibase-db` | Shared PostgreSQL 15 database |
| `multibase-studio` | Supabase Studio UI (shared) |
| `multibase-pooler` | Connection pooler (Supavisor) |
| `multibase-analytics` | Logflare analytics backend |
| `multibase-vector` | Vector log aggregator |
| `multibase-meta` | Postgres metadata API |
| `multibase-imgproxy` | Image transformation proxy |
| `multibase-nginx-gateway` | Internal routing gateway |

These containers start automatically on server boot via a systemd service (`multibase-shared.service`).

### Generated Configuration Files

| File | Purpose |
| --- | --- |
| `/opt/multibase/dashboard/backend/.env` | Backend config (port, DB, Redis, CORS, secrets) |
| `/opt/multibase/dashboard/frontend/.env` | Frontend config (`VITE_API_URL`, `VITE_ROOT_DOMAIN`) |
| `/opt/multibase/shared/.env.shared` | Docker stack config (JWT secrets, passwords, ports) |
| `/opt/multibase/ecosystem.config.js` | PM2 process configuration |
| `/etc/nginx/sites-available/multibase-backend` | Backend Nginx vhost |
| `/etc/nginx/sites-available/multibase-frontend` | Frontend Nginx vhost |

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
├── shared/                # Shared Docker infrastructure
│   ├── docker-compose.shared.yml
│   ├── .env.shared        # Docker stack secrets & config
│   └── volumes/           # Persistent data for shared containers
├── projects/              # Per-instance Supabase data
├── nginx/
│   └── sites-enabled/     # Dynamic per-instance Nginx configs
├── backups/               # Backup storage
├── logs/                  # PM2 log files
├── venv/                  # Python virtual environment
└── ecosystem.config.js    # PM2 process configuration
```

---

## Example: Installation Output (Backend Only)

The following shows a typical re-install run in **Split Backend** mode. Your first run will pull Docker images (~8 GB) and may take 10–20 min on a fresh server.

```text
curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/cloud-version/deployment/install.sh | sudo bash

======================================================

    __  __       _ _   _ _
   |  \/  |_   _| | |_(_) |__   __ _ ___  ___
   | |\/| | | | | | __| | '_ \ / _` / __|/ _ \
   | |  | | |_| | | |_| | |_) | (_| \__ \  __/
   |_|  |_|\__,_|_|\__|_|_.__/ \__,_|___/\___|

   Dashboard Installer v2.0.0
======================================================

  Welcome! This script will set up Multibase
  on your server.

  Press Enter to continue...

------------------------------------------------------
  Previous installation detected
------------------------------------------------------

  Mode:    split-backend
  Domain:  backend.example.com
  Admin:   admin (you@example.com)
  SSL:     y  |  UFW: n

  [1] Use these settings and start installation directly
  [2] Edit settings (go through wizard with pre-filled defaults)

  Choice [1]: 1

  OK — resuming installation with existing settings.


Starting installation...


[1/18] Installing dependencies...
        [OK] curl (already installed)
        [OK] wget (already installed)
        [OK] git (already installed)
        [OK] openssl (already installed)
        [OK] build-essential (already installed)
        [OK] software-properties-common (already installed)
        [OK] Node.js v20.20.0 (already installed)
        [OK] Docker 29.2.1 (already installed)
        [OK] Docker Compose (already installed)
        [OK] Python 3.12.3 (already installed)
        [OK] Python venv (python3.12-venv installed)
        [OK] Nginx 1.24.0 (Ubuntu) (already installed)
        [OK] Certbot (already installed)
        [OK] PM2 6.0.14 (already installed)

[2/18] Creating user and directories...
        [OK] User 'multibase' already exists
        [OK] User added to docker group
        [OK] Created /opt/multibase
        [OK] Created /opt/multibase/logs
        [OK] Created /opt/multibase/nginx/sites-enabled
        [OK] Created /opt/multibase/projects
        [OK] Created /opt/multibase/backups

[3/18] Configuring sudoers for nginx and certbot...
        [OK] sudoers configured for multibase (nginx + certbot)

[4/18] Cloning repository...
        [OK] Repository already exists, pulling latest...
        [OK] Repository updated

[5/18] Setting up Python environment...
        [OK] Virtual environment already exists and is functional
        [OK] Python requirements installed (psutil, requests, pyjwt)

[6/18] Building backend...
        [OK] Dependencies installed
        [OK] Prisma client generated
        [OK] Backend built

[7/18] Setting up Shared Infrastructure...
        [OK] .env.shared already exists – skipping generation

        [1/2] Pulling Docker images (first install ~8 GB, may take 10–20 min)...
        ✓ supabase/studio:latest (already cached)
        ✓ supabase/supavisor:2.4.14 (already cached)
        ✓ timberio/vector:0.28.1-alpine (already cached)
        ✓ darthsim/imgproxy:v3.8.0 (already cached)
        ✓ supabase/logflare:1.12.0 (already cached)
        ✓ supabase/postgres-meta:v0.87.1 (already cached)
        ✓ nginx:alpine (already cached)
        ✓ supabase/postgres:15.8.1.060 (already cached)

        [2/2] Starting containers...
        ✓ multibase-analytics       Up 6 minutes (healthy)
        ✓ multibase-db              Up 6 minutes (healthy)
        ✓ multibase-imgproxy        Up 6 minutes (healthy)
        ✓ multibase-meta            Up 5 minutes (healthy)
        ✓ multibase-nginx-gateway   Up 6 minutes (healthy)
        ✓ multibase-pooler          Up 5 minutes (healthy)
        ✓ multibase-studio          Up 5 minutes (healthy)
        ✓ multibase-vector          Up 6 minutes (healthy)

        [OK] Shared stack started

[8/18] Waiting for PostgreSQL to be ready...
        [OK] PostgreSQL is ready

[9/18] Generating configuration files...
        [OK] Backend .env created
        [OK] PM2 ecosystem.config.js created

[10/18] Applying database migrations...
        [OK] Database migrations applied

[11/18] Starting Redis...
        [OK] Redis container already running

[12/18] Configuring Nginx...
        [OK] Backend vhost created (backend.example.com)
        [OK] Nginx configuration tested and reloaded

[13/18] Starting backend via PM2...
        [OK] Backend started
        [OK] PM2 process list saved
        [OK] PM2 startup configured (auto-start on reboot)
        [OK] PM2 log rotation enabled

[14/18] Configuring Shared Infrastructure auto-start on boot...
        [OK] multibase-shared.service enabled (auto-start on reboot)

[15/18] Setting up SSL certificates...

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACTION REQUIRED — Wildcard SSL for *.example.com
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  certbot will now show you a DNS TXT record to add.

  IMPORTANT: Do NOT press Enter immediately!
  After adding the TXT record at your DNS provider, verify
  that it has propagated by running this command in another
  terminal before pressing Enter:

    dig TXT _acme-challenge.example.com +short

  Only press Enter once the expected value appears in the output.
  DNS propagation typically takes 1–5 minutes.

  Successfully received certificate.
  Certificate is saved at: /etc/letsencrypt/live/example.com/fullchain.pem
  This certificate expires on 2026-05-30.

        [NEW] Wildcard SSL certificate obtained for *.example.com

[16/18] Configuring firewall and swap...
        [SKIP] UFW firewall (disabled)
        [NEW] 2 GB swap file created

[17/18] Creating admin account...
        [SKIP] Admin account (existing: you@example.com)

[18/18] Verifying installation...
        [OK] Nginx is running
        [OK] Backend is running via PM2
        [OK] Redis container is running

======================================================
  Installation Complete!
======================================================

  Backend:   https://backend.example.com
  Frontend:  https://multibase.example.com (remote)

  Admin Login:
    Username:  admin
    Email:     you@example.com
    Password:  __existing__

  Next Steps:
    - Point your DNS records to this server's IP
    - Set up *.backend.example.com wildcard DNS
      for Supabase instance subdomains
    - Run the installer on your frontend server
      and choose option [2] Split VPS -- Frontend Only
    - Log in and create your first Supabase instance

  Management:
    Update:     sudo /opt/multibase/deployment/install.sh --update
    Uninstall:  sudo /opt/multibase/deployment/install.sh --uninstall

  Install log: /var/log/multibase-install.log
```

---

## DNS Setup

After installation, configure your DNS provider with these records:

| Record | Type | Value |
| --- | --- | --- |
| `dashboard.example.com` | A | Your server IP |
| `backend.example.com` | A | Your server IP |
| `*.backend.example.com` | A | Your server IP |

> **The wildcard A record** (`*.backend.example.com`) is required so each Supabase instance gets its own subdomain (e.g. `my-app.backend.example.com`). Without it, instances won't be reachable.

> **Note:** If you chose _wildcard SSL_ during installation, you also had to add a `_acme-challenge` DNS TXT record as prompted by the installer. That is a one-time step for certificate issuance and separate from the A records above.

---

## Updating

To update an existing installation to the latest version:

```bash
sudo /opt/multibase/deployment/install.sh --update
```

This will:

1. Pull the latest code from the repository
2. Reinstall Node.js dependencies
3. Regenerate the Prisma client
4. Rebuild the backend (TypeScript compilation)
5. Run database migrations
6. Restart PM2 and reload Nginx

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
# Switch to the service user (for PM2 and log access)
sudo su - multibase

# Check backend process status
pm2 status

# View live backend logs
pm2 logs multibase-backend

# Restart the backend
pm2 restart multibase-backend

# Test Nginx configuration
sudo nginx -t

# Reload Nginx after config changes
sudo systemctl reload nginx

# Check shared Docker containers
docker ps --filter name=multibase

# View the full install log
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

### Redis not running or wrong password

```bash
docker ps | grep multibase-redis
docker logs multibase-redis

# Re-run the installer — it detects password drift and fixes it automatically
sudo /opt/multibase/deployment/install.sh
```

### Shared Docker containers not running

```bash
# Check status
docker ps --filter name=multibase

# Start via systemd
sudo systemctl start multibase-shared

# Or directly with docker compose
cd /opt/multibase/shared
sudo docker compose -f docker-compose.shared.yml --env-file .env.shared -p multibase-shared up -d
```

### PostgreSQL not ready

```bash
docker logs multibase-db --tail 50
docker exec multibase-db pg_isready -U postgres
```

### WebSocket / real-time not working

Make sure the `/socket.io` proxy block in your Nginx vhost includes `proxy_read_timeout 3600s` for long-lived connections.

### Frontend shows blank page

The `VITE_API_URL` in the frontend `.env` might be wrong. Fix it and rebuild:

```bash
cat /opt/multibase/dashboard/frontend/.env
# Edit VITE_API_URL if needed, then:
cd /opt/multibase/dashboard/frontend
sudo -u multibase npm run build
```
