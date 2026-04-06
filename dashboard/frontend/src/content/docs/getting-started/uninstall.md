# Uninstall

Multibase provides a dedicated uninstall script that cleanly removes all components installed by the installer.

## Quick Start

```bash
sudo bash /opt/multibase/deployment/uninstall.sh
```

The script requires confirmation by typing `YES` before proceeding. Use `--yes` to skip the prompt (e.g. for automation).

---

## Options

| Flag | Description |
| --- | --- |
| *(no flags)* | Standard removal — processes, containers, configs, directories, user |
| `--keep-data` | Preserve project data, database, and backups |
| `--del-all` | Also remove system packages (Node.js, Docker, Nginx, PM2, Certbot) |
| `--yes` | Skip the confirmation prompt |

Flags can be combined:

```bash
# Remove absolutely everything, no questions asked
sudo bash /opt/multibase/deployment/uninstall.sh --del-all --yes
```

---

## What Gets Removed

### Standard Removal

The default `uninstall.sh` removes everything Multibase added to your system:

| Step | Component |
| --- | --- |
| 1 | PM2 processes and startup service |
| 2 | Shared infrastructure (Docker Compose stack + volumes) |
| 3 | Redis container |
| 4 | All project instance containers + volumes |
| 5 | Docker images (supabase/*, redis) |
| 6 | Nginx vhosts (`multibase-frontend`, `multibase-backend`) |
| 7 | SSL certificates (Let's Encrypt) |
| 8 | Sudoers configuration (`/etc/sudoers.d/multibase`) |
| 9 | Swap file (if created by installer) |
| 10 | Installation directory (`/opt/multibase`) |
| 11 | System user (`multibase` + home directory) |
| 12 | Log file, Docker networks, temp files |

### With `--del-all`

In addition to everything above, these system packages are also removed:

| Package | Details |
| --- | --- |
| PM2 | Global npm package |
| Certbot | + python3-certbot-nginx |
| Nginx | + `/etc/nginx` directory |
| Node.js | + Nodesource repository |
| Docker | + all Docker data (`/var/lib/docker`) |
| python3-venv | Python virtual environment module |

Orphaned dependencies are cleaned up via `apt autoremove`.

### With `--keep-data`

The following directories are preserved:

- `/opt/multibase/projects/` — your Supabase instances
- `/opt/multibase/dashboard/backend/data/` — SQLite database
- `/opt/multibase/backups/` — any backups you created

Everything else is removed normally.

---

## Examples

### Standard removal (interactive)

```bash
sudo bash /opt/multibase/deployment/uninstall.sh
```

You will see a summary of what will be removed and must type `YES` to confirm.

### Keep your data for a fresh reinstall

```bash
sudo bash /opt/multibase/deployment/uninstall.sh --keep-data
```

After reinstalling, your project data and database will still be in `/opt/multibase`.

### Full system cleanup

```bash
sudo bash /opt/multibase/deployment/uninstall.sh --del-all --yes
```

Removes everything including Node.js, Docker, and Nginx — returns the server to a clean state.

---

## After Uninstalling

If you used `--del-all`, your server is clean. If you did a standard removal, these system packages remain installed (remove manually if desired):

```bash
# Node.js
sudo apt remove nodejs

# Docker
sudo apt remove docker-ce docker-ce-cli containerd.io

# Nginx
sudo apt remove nginx

# Certbot
sudo apt remove certbot python3-certbot-nginx

# PM2
sudo npm uninstall -g pm2
```

To remove **all** Docker data (containers, images, volumes from other projects too):

```bash
docker system prune -a --volumes
```
