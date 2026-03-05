# Multibase Installation Guide

## Quick Start

Run this one-liner on a fresh Ubuntu 22.04+ server:

```bash
curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/main/deployment/install.sh | sudo bash
```

The interactive wizard will guide you through the entire setup.

---

## Requirements

| Component | Minimum                    |
| --------- | -------------------------- |
| OS        | Ubuntu 22.04+ / Debian 12+ |
| RAM       | 1 GB (4 GB+ recommended)   |
| Disk      | 5 GB free space            |
| Access    | Root / sudo                |

All dependencies (Node.js, Docker, Nginx, Python, PM2, Certbot) are automatically installed by the script.

---

## Deployment Modes

### 1. Single Server (Recommended)

Frontend and backend on the same server. Best for getting started.

```bash
curl -sSL https://...install.sh | sudo bash
# Choose: [1] Single Server
```

### 2. Split VPS -- Frontend Only

Static frontend on a separate server. Backend runs elsewhere.

```bash
curl -sSL https://...install.sh | sudo bash
# Choose: [2] Split VPS -- Frontend Only
```

Only installs Node.js, Nginx, and Certbot. No Docker or PM2 needed.

### 3. Split VPS -- Backend Only

API + Docker on a dedicated server. Frontend runs elsewhere.

```bash
curl -sSL https://...install.sh | sudo bash
# Choose: [3] Split VPS -- Backend Only
```

**For Split VPS:** Run the script on each server separately. Install the backend server first, then the frontend server.

---

## What the Wizard Asks

The installer guides you through 6 steps:

| Step               | What it asks                                                    |
| ------------------ | --------------------------------------------------------------- |
| 1. Deployment Mode | Single Server, Split Frontend, or Split Backend                 |
| 2. Domains         | Frontend domain, Backend domain (or remote URLs for split mode) |
| 3. Admin Account   | Username, email, password (auto-generated if skipped)           |
| 4. SSL             | Enable Let's Encrypt? Email for certificate registration        |
| 5. Options         | UFW firewall, swap file (recommended for < 4 GB RAM)            |
| 6. Confirmation    | Review summary before starting                                  |

---

## What Gets Installed

### Dependencies

| Package          | Single | Frontend Only | Backend Only |
| ---------------- | :----: | :-----------: | :----------: |
| Node.js 20       |  Yes   |      Yes      |     Yes      |
| Docker + Compose |  Yes   |      No       |     Yes      |
| Python 3 + pip   |  Yes   |      No       |     Yes      |
| Nginx            |  Yes   |      Yes      |     Yes      |
| Certbot          |  Yes   |      Yes      |     Yes      |
| PM2              |  Yes   |      No       |     Yes      |

### Generated Configuration Files

| File                                            | Purpose                                          |
| ----------------------------------------------- | ------------------------------------------------ |
| `/opt/multibase/dashboard/backend/.env`         | Backend config (ports, DB, Redis, CORS, secrets) |
| `/opt/multibase/dashboard/frontend/.env`        | Frontend config (`VITE_API_URL`)                 |
| `/etc/nginx/sites-available/multibase-frontend` | Frontend Nginx vhost (static files + API proxy)  |
| `/etc/nginx/sites-available/multibase-backend`  | Backend Nginx vhost (reverse proxy to port 3001) |
| `/opt/multibase/ecosystem.config.js`            | PM2 process configuration                        |

All domains entered during the wizard are automatically written to these config files.

### Directory Structure

```
/opt/multibase/
  dashboard/
    backend/          # Node.js API
      data/           # SQLite database
      .env            # Backend configuration
    frontend/
      dist/           # Built static files
      .env            # Frontend configuration
  projects/           # Supabase instance data
  backups/            # Backup storage
  logs/               # PM2 log files
  venv/               # Python virtual environment
  nginx/
    sites-enabled/    # Dynamic instance Nginx configs
  ecosystem.config.js # PM2 configuration
```

---

## Example: Installation Output (Backend Option)

```bash
curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/cloud-version/deployment/install.sh | sudo bash
```

```text
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
  Domain:  backend.tyto-design.de
  Admin:   admin (herr_tomson@web.de)
  SSL:     y  |  UFW: n

  [1] Use these settings and start installation directly
  [2] Edit settings (go through wizard with pre-filled defaults)

  Choice [1]: 1

  OK — resuming installation with existing settings.


Starting installation...


[1/18] Installing dependencies...
[2026-03-01 17:44:46] STEP 1/18: Installing dependencies...
        [OK] curl (already installed)
[2026-03-01 17:44:49]   OK: curl (already installed)
        [OK] wget (already installed)
[2026-03-01 17:44:49]   OK: wget (already installed)
        [OK] git (already installed)
[2026-03-01 17:44:49]   OK: git (already installed)
        [OK] openssl (already installed)
[2026-03-01 17:44:49]   OK: openssl (already installed)
        [OK] build-essential (already installed)
[2026-03-01 17:44:49]   OK: build-essential (already installed)
        [OK] software-properties-common (already installed)
[2026-03-01 17:44:49]   OK: software-properties-common (already installed)
        [OK] Node.js v20.20.0 (already installed)
[2026-03-01 17:44:49]   OK: Node.js v20.20.0 (already installed)
        [OK] Docker 29.2.1 (already installed)
[2026-03-01 17:44:49]   OK: Docker 29.2.1 (already installed)
        [OK] Docker Compose (already installed)
[2026-03-01 17:44:49]   OK: Docker Compose (already installed)
        [OK] Python 3.12.3 (already installed)
[2026-03-01 17:44:49]   OK: Python 3.12.3 (already installed)
        [OK] Python venv (python3.12-venv installed)
[2026-03-01 17:44:50]   OK: Python venv (python3.12-venv installed)
        [OK] Nginx 1.24.0 (Ubuntu) (already installed)
[2026-03-01 17:44:50]   OK: Nginx 1.24.0 (Ubuntu) (already installed)
        [OK] Certbot (already installed)
[2026-03-01 17:44:50]   OK: Certbot (already installed)
        [OK] PM2 6.0.14 (already installed)
[2026-03-01 17:44:51]   OK: PM2 6.0.14 (already installed)

[2/18] Creating user and directories...
[2026-03-01 17:44:51] STEP 2/18: Creating user and directories...
        [OK] User 'multibase' already exists
[2026-03-01 17:44:51]   OK: User 'multibase' already exists
        [OK] User added to docker group
[2026-03-01 17:44:51]   OK: User added to docker group
        [OK] Created /opt/multibase
[2026-03-01 17:44:51]   OK: Created /opt/multibase
        [OK] Created /opt/multibase/logs
[2026-03-01 17:44:51]   OK: Created /opt/multibase/logs
        [OK] Created /opt/multibase/nginx/sites-enabled
[2026-03-01 17:44:51]   OK: Created /opt/multibase/nginx/sites-enabled
        [OK] Created /opt/multibase/projects
[2026-03-01 17:44:51]   OK: Created /opt/multibase/projects
        [OK] Created /opt/multibase/backups
[2026-03-01 17:44:51]   OK: Created /opt/multibase/backups

[3/18] Configuring sudoers for nginx and certbot...
[2026-03-01 17:44:51] STEP 3/18: Configuring sudoers for nginx and certbot...
        [OK] sudoers configured for multibase (nginx + certbot)
[2026-03-01 17:44:51]   OK: sudoers configured for multibase (nginx + certbot)

[4/18] Cloning repository...
[2026-03-01 17:44:51] STEP 4/18: Cloning repository...
        [OK] Repository already exists, pulling latest...
[2026-03-01 17:44:51]   OK: Repository already exists, pulling latest...
        [OK] Repository updated
[2026-03-01 17:44:52]   OK: Repository updated

[5/18] Setting up Python environment...
[2026-03-01 17:44:52] STEP 5/18: Setting up Python environment...
        [OK] Virtual environment already exists and is functional
[2026-03-01 17:44:52]   OK: Virtual environment already exists and is functional
        [OK] Python requirements installed (psutil, requests, pyjwt)
[2026-03-01 17:44:53]   OK: Python requirements installed (psutil, requests, pyjwt)

[6/18] Building backend...
[2026-03-01 17:44:53] STEP 6/18: Building backend...
        [OK] Dependencies installed
[2026-03-01 17:45:13]   OK: Dependencies installed
        [OK] Prisma client generated
[2026-03-01 17:45:17]   OK: Prisma client generated
        [OK] Backend built
[2026-03-01 17:45:33]   OK: Backend built

[7/18] Setting up Shared Infrastructure...
[2026-03-01 17:45:35] STEP 7/18: Setting up Shared Infrastructure...
        [OK] .env.shared already exists – skipping generation
[2026-03-01 17:45:35]   OK: .env.shared already exists – skipping generation

        [1/2] Pulling Docker images (first install ~8 GB, may take 10–20 min)...
        ✓ supabase/studio:latest (already cached)
[2026-03-01 17:45:35]   Image cached: supabase/studio:latest
        ✓ supabase/supavisor:2.4.14 (already cached)
[2026-03-01 17:45:35]   Image cached: supabase/supavisor:2.4.14
        ✓ timberio/vector:0.28.1-alpine (already cached)
[2026-03-01 17:45:35]   Image cached: timberio/vector:0.28.1-alpine
        ✓ darthsim/imgproxy:v3.8.0 (already cached)
[2026-03-01 17:45:36]   Image cached: darthsim/imgproxy:v3.8.0
        ✓ supabase/logflare:1.12.0 (already cached)
[2026-03-01 17:45:36]   Image cached: supabase/logflare:1.12.0
        ✓ supabase/postgres-meta:v0.87.1 (already cached)
[2026-03-01 17:45:36]   Image cached: supabase/postgres-meta:v0.87.1
        ✓ nginx:alpine (already cached)
[2026-03-01 17:45:36]   Image cached: nginx:alpine
        ✓ supabase/postgres:15.8.1.060 (already cached)
[2026-03-01 17:45:36]   Image cached: supabase/postgres:15.8.1.060

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
[2026-03-01 17:45:39]   OK: Shared stack started

[8/18] Waiting for PostgreSQL to be ready...
[2026-03-01 17:45:39] STEP 8/18: Waiting for PostgreSQL to be ready...
        [OK] PostgreSQL is ready
[2026-03-01 17:45:39]   OK: PostgreSQL is ready
[2026-03-01 17:45:39] Fixed postgres data directory ownership to 105:106

[9/18] Generating configuration files...
[2026-03-01 17:45:39] STEP 9/18: Generating configuration files...
        [OK] Backend .env created
[2026-03-01 17:45:39]   OK: Backend .env created
        [OK] PM2 ecosystem.config.js created
[2026-03-01 17:45:39]   OK: PM2 ecosystem.config.js created

[10/18] Applying database migrations...
[2026-03-01 17:45:39] STEP 10/18: Applying database migrations...
        [OK] Database migrations applied
[2026-03-01 17:45:41]   OK: Database migrations applied

[11/18] Starting Redis...
[2026-03-01 17:45:41] STEP 11/18: Starting Redis...
        [OK] Redis container already running
[2026-03-01 17:45:41]   OK: Redis container already running

[12/18] Configuring Nginx...
[2026-03-01 17:45:41] STEP 12/18: Configuring Nginx...
        [OK] Backend vhost created (backend.tyto-design.de)
[2026-03-01 17:45:41]   OK: Backend vhost created (backend.tyto-design.de)
        [OK] Nginx configuration tested and reloaded
[2026-03-01 17:45:41]   OK: Nginx configuration tested and reloaded

[13/18] Starting backend via PM2...
[2026-03-01 17:45:41] STEP 13/18: Starting backend via PM2...
[PM2] Applying action deleteProcessId on app [multibase-backend](ids: [ 0 ])
[PM2] [multibase-backend](0) ✓
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
Module
┌────┬────────────────────┬──────────┬──────────┬──────────┐
│ id │ name               │ status   │ cpu      │ mem      │
├────┼────────────────────┼──────────┼──────────┼──────────┤
│ 1  │ pm2-logrotate      │ online   │ 0%       │ 57.8mb   │
└────┴────────────────────┴──────────┴──────────┴──────────┘
        [OK] Backend started
[2026-03-01 17:45:42]   OK: Backend started
        [OK] PM2 process list saved
[2026-03-01 17:45:42]   OK: PM2 process list saved
        [OK] PM2 startup configured (auto-start on reboot)
[2026-03-01 17:45:43]   OK: PM2 startup configured (auto-start on reboot)
        [OK] PM2 log rotation enabled
[2026-03-01 17:45:56]   OK: PM2 log rotation enabled

[14/18] Configuring Shared Infrastructure auto-start on boot...
[2026-03-01 17:45:56] STEP 14/18: Configuring Shared Infrastructure auto-start on boot...
        [OK] multibase-shared.service enabled (auto-start on reboot)
[2026-03-01 17:45:57]   OK: multibase-shared.service enabled (auto-start on reboot)

[15/18] Setting up SSL certificates...
[2026-03-01 17:45:57] STEP 15/18: Setting up SSL certificates...

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ACTION REQUIRED — Wildcard SSL for *.tyto-design.de
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  certbot will now show you a DNS TXT record to add.

  IMPORTANT: Do NOT press Enter immediately!
  After adding the TXT record at your DNS provider, verify
  that it has propagated by running this command in another
  terminal before pressing Enter:

    dig TXT _acme-challenge.tyto-design.de +short
    (or: nslookup -type=TXT _acme-challenge.tyto-design.de 8.8.8.8)

  Only press Enter once the expected value appears in the output.
  DNS propagation typically takes 1–5 minutes.

[2026-03-01 17:45:57] Running interactive certbot for *.tyto-design.de ...
Saving debug log to /var/log/letsencrypt/letsencrypt.log
Requesting a certificate for *.tyto-design.de

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Please deploy a DNS TXT record under the name:

_acme-challenge.tyto-design.de.

with the following value:

39-PA3nzmOLhISlA9on12ViBs12EgDvBMUL0d0rCyrg

Before continuing, verify the TXT record has been deployed. Depending on the DNS
provider, this may take some time, from a few seconds to multiple minutes. You can
check if it has finished deploying with aid of online tools, such as the Google
Admin Toolbox: https://toolbox.googleapps.com/apps/dig/#TXT/_acme-challenge.tyto-design.de.
Look for one or more bolded line(s) below the line ';ANSWER'. It should show the
value(s) you've just added.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Press Enter to Continue

Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/tyto-design.de/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/tyto-design.de/privkey.pem
This certificate expires on 2026-05-30.
These files will be updated when the certificate renews.

NEXT STEPS:
- This certificate will not be renewed automatically. Autorenewal of --manual
  certificates requires the use of an authentication hook script
  (--manual-auth-hook) but one was not provided. To renew this certificate,
  repeat this same certbot command before the certificate's expiry date.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
[2026-03-01 17:47:22] certbot certonly succeeded for *.tyto-design.de
        [NEW] Wildcard SSL certificate obtained for *.tyto-design.de
[2026-03-01 17:47:25]   NEW: Wildcard SSL certificate obtained for *.tyto-design.de

[16/18] Configuring firewall and swap...
[2026-03-01 17:47:25] STEP 16/18: Configuring firewall and swap...
        [SKIP] UFW firewall (disabled)
[2026-03-01 17:47:25]   SKIP: UFW firewall (disabled)
        [NEW] 2 GB swap file created
[2026-03-01 17:47:25]   NEW: 2 GB swap file created

[17/18] Creating admin account...
[2026-03-01 17:47:25] STEP 17/18: Creating admin account...
        [SKIP] Admin account (existing: herr_tomson@web.de)
[2026-03-01 17:47:25]   SKIP: Admin account (existing: herr_tomson@web.de)

[18/18] Verifying installation...
[2026-03-01 17:47:25] STEP 18/18: Verifying installation...
        [OK] Nginx is running
[2026-03-01 17:47:25]   OK: Nginx is running
        [OK] Backend is running via PM2
[2026-03-01 17:47:26]   OK: Backend is running via PM2
        [OK] Redis container is running
[2026-03-01 17:47:26]   OK: Redis container is running

======================================================
  Installation Complete!
======================================================

  Backend:   https://backend.tyto-design.de
  Frontend:  https://multibase.tyto-design.de (remote)

  Admin Login:
    Username:  admin
    Email:     herr_tomson@web.de
    Password:  __existing__

  Save these credentials! They will not be shown again.

  Next Steps:
    - Point your DNS records to this server's IP
    - Set up *.backend.tyto-design.de wildcard DNS
      for Supabase instance subdomains
    - Run the installer on your frontend server
      and choose option [2] Split VPS -- Frontend Only
    - Log in and create your first Supabase instance

  Useful Commands:

  Service User:
    The backend runs as system user multibase.
    This user has no password (security best practice).
    To switch to this user for PM2/log access:

    sudo su - multibase

    pm2 status                     -- Check backend status
    pm2 logs multibase-backend     -- View backend logs
    pm2 restart multibase-backend  -- Restart backend
    sudo nginx -t                  -- Test Nginx config
    sudo systemctl reload nginx    -- Reload Nginx

  Management:
    Update:     sudo /opt/multibase/deployment/install.sh --update
    Uninstall:  sudo /opt/multibase/deployment/install.sh --uninstall

  Install log: /var/log/multibase-install.log
```

---

## DNS Setup

After installation, configure your DNS records:

| Record                  | Type | Value          |
| ----------------------- | ---- | -------------- |
| `dashboard.example.com` | A    | Your server IP |
| `backend.example.com`   | A    | Your server IP |
| `*.backend.example.com` | A    | Your server IP |

The wildcard record is required for Supabase instance subdomains (e.g. `my-app.backend.example.com`).

---

## Update

Update an existing installation:

```bash
sudo /opt/multibase/deployment/install.sh --update
```

This will:

1. Pull the latest code
2. Rebuild backend and frontend
3. Run database migrations
4. Restart services

---

## Uninstall

A dedicated uninstall script is provided at `deployment/uninstall.sh`.

```bash
# Standard removal (processes, containers, configs, user, install dir)
sudo bash /opt/multibase/deployment/uninstall.sh

# Keep project data and database
sudo bash /opt/multibase/deployment/uninstall.sh --keep-data

# Also remove ALL system packages (Node.js, Docker, Nginx, PM2, Certbot)
sudo bash /opt/multibase/deployment/uninstall.sh --del-all

# Skip confirmation prompt
sudo bash /opt/multibase/deployment/uninstall.sh --yes

# Combine flags
sudo bash /opt/multibase/deployment/uninstall.sh --del-all --yes
```

### What gets removed

| Component | Standard | `--del-all` |
| --- | --- | --- |
| PM2 processes + startup service | ✅ | ✅ |
| Shared infrastructure containers | ✅ | ✅ |
| Redis container | ✅ | ✅ |
| Project instance containers | ✅ | ✅ |
| Docker images (supabase/*, redis) | ✅ | ✅ |
| Nginx vhosts | ✅ | ✅ |
| SSL certificates | ✅ | ✅ |
| Sudoers config | ✅ | ✅ |
| Swap file | ✅ | ✅ |
| Install directory (`/opt/multibase`) | ✅ | ✅ |
| System user (`multibase`) | ✅ | ✅ |
| Log file | ✅ | ✅ |
| Node.js | ❌ | ✅ |
| Docker + all Docker data | ❌ | ✅ |
| Nginx (package) | ❌ | ✅ |
| PM2 (global) | ❌ | ✅ |
| Certbot | ❌ | ✅ |

---

## Useful Commands

```bash
# Check backend status
pm2 status

# View backend logs
pm2 logs multibase-backend

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# View install log
cat /var/log/multibase-install.log
```

---

## Troubleshooting

### Backend not starting

```bash
pm2 logs multibase-backend --lines 50
```

### Nginx configuration error

```bash
sudo nginx -t
```

### SSL certificate issues

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### Redis not running

```bash
docker ps | grep multibase-redis
docker logs multibase-redis
```

### WebSocket connection fails

Make sure the `/socket.io` location block is present in your frontend Nginx vhost with `proxy_read_timeout 3600s`.

### Frontend shows blank page

Check that the frontend `.env` has the correct `VITE_API_URL` pointing to your backend domain, then rebuild:

```bash
cd /opt/multibase/dashboard/frontend
sudo -u multibase npm run build
```
