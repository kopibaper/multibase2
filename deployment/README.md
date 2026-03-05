# Multibase Dashboard - Deployment

This directory contains the automated installer for the Multibase Dashboard.

## Quick Start

```bash
curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/main/deployment/install.sh | sudo bash
```

For the full installation guide, see [INSTALL.md](../INSTALL.md) in the repo root.

## Script

| Command                                        | Description                                |
| ---------------------------------------------- | ------------------------------------------ |
| `sudo bash install.sh`                         | Fresh installation with interactive wizard |
| `sudo bash install.sh --update`                | Update existing installation               |
| `sudo bash uninstall.sh`                       | Remove installation                        |
| `sudo bash uninstall.sh --keep-data`           | Remove but keep project data + database    |
| `sudo bash uninstall.sh --del-all`             | Also remove system packages (Node, Docker) |
| `sudo bash uninstall.sh --yes`                 | Skip confirmation prompt                   |

## What the Installer Does

1. **Pre-flight checks** -- OS, root access, RAM, disk space
2. **Interactive wizard** -- deployment mode, domains, admin account, SSL, firewall
3. **Installs dependencies** -- Node.js 20, Docker, Python 3, Nginx, Certbot, PM2
4. **Clones repository** -- to `/opt/multibase`
5. **Builds application** -- backend (TypeScript + Prisma) and frontend (React)
6. **Generates configs** -- `.env` files, Nginx vhosts, PM2 ecosystem
7. **Starts services** -- PM2 backend, Redis container, Nginx, SSL
8. **Creates admin** -- initial admin account with bcrypt-hashed password

## Deployment Modes

- **Single Server** -- frontend + backend on one server
- **Split VPS -- Frontend** -- static frontend only (no Docker/PM2 needed)
- **Split VPS -- Backend** -- API + Docker only

## Requirements

- Ubuntu 22.04+ / Debian 12+
- 1 GB RAM minimum (4 GB+ recommended)
- 5 GB free disk space
- Root / sudo access

## Configuration Files

| File                                            | Purpose                |
| ----------------------------------------------- | ---------------------- |
| `/opt/multibase/dashboard/backend/.env`         | Backend configuration  |
| `/opt/multibase/dashboard/frontend/.env`        | Frontend configuration |
| `/etc/nginx/sites-available/multibase-frontend` | Frontend Nginx vhost   |
| `/etc/nginx/sites-available/multibase-backend`  | Backend Nginx vhost    |
| `/opt/multibase/ecosystem.config.js`            | PM2 configuration      |

## Useful Commands

```bash
pm2 status                     # Backend status
pm2 logs multibase-backend     # Backend logs
sudo nginx -t                  # Test Nginx config
cat /var/log/multibase-install.log  # Install log
```
