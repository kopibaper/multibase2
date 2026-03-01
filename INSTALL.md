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
