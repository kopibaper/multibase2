# Nginx Gateway — Developer Notes

The `multibase-nginx-gateway` container is the single API gateway for all tenants. Understanding how its port bindings work is essential when switching between platforms.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  docker-compose.shared.yml   (committed to Git)     │
│  → Port 8000 (main gateway, fixed)                  │
├─────────────────────────────────────────────────────┤
│  docker-compose.override.yml  (auto-generated)      │
│  → ALL tenant ports (8786, 8091, 5480, …)           │
│  → Bind address from NGINX_BIND_HOST                │
└─────────────────────────────────────────────────────┘
```

Tenant ports are **never** written to `docker-compose.shared.yml`. They live exclusively in the auto-generated override file. Every call to `setup_shared.py::add_tenant_port()` rebuilds this file and restarts only the nginx-gateway container.

---

## Platform Toggle: Linux vs. Windows

The bind address is controlled by one variable in `shared/.env.shared`:

| Platform | Value | Effect |
|---|---|---|
| **Linux** | `NGINX_BIND_HOST=127.0.0.1` | Ports bound to loopback only (more secure) |
| **Windows / Docker Desktop** | `NGINX_BIND_HOST=0.0.0.0` | Ports bound to all interfaces (required for host access) |

After changing the value, apply it once:

```bash
cd shared
docker compose \
  -f docker-compose.shared.yml \
  -f docker-compose.override.yml \
  --env-file .env.shared \
  up -d --no-deps nginx-gateway
```

---

## Known Pitfall: Duplicate Port Bindings

**Symptom:** nginx-gateway container stays in `Created` state, never starts. Docker logs show:

```
failed to listen on TCP socket: address already in use
```

**Cause:** The same tenant port appears in both `docker-compose.shared.yml` (bound to `0.0.0.0`) **and** `docker-compose.override.yml` (bound to `127.0.0.1`). Since `0.0.0.0` covers all interfaces including loopback, the second binding collides.

**Fix:**
- Never add `NGINX_PORT_N` entries to `docker-compose.shared.yml`.
- Only `SHARED_GATEWAY_PORT` (port `8000`) belongs there.
- All tenant ports are managed automatically by `setup_shared.py`.

---

## Nginx Reload vs. Container Restart

The gateway supports **zero-downtime reloads** (`nginx -s reload`, ~50 ms). The backend always attempts a reload first and only falls back to `docker restart` if the config test fails.

```bash
# Manual reload (zero downtime)
docker exec multibase-nginx-gateway nginx -s reload

# Validate config before reload
docker exec multibase-nginx-gateway nginx -t
```

Config files per tenant are located at:
```
shared/volumes/nginx/tenants/<tenant-name>.conf
```

---

## Regenerating All Tenant Configs

If tenant configs get lost or the gateway is recreated from scratch:

```bash
cd /opt/multibase   # or your repo root
python3 setup_shared.py regenerate-nginx
```

This reads every `projects/*/. env`, generates a fresh `.conf` file for each tenant and reloads the gateway.
