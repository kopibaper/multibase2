---
name: health
description: Check system health – backend API, PM2, Docker containers, Redis, disk usage
---

Run a full system health check for Multibase production and/or local dev.

## Steps

1. **Backend API health** (production):

```bash
curl -s https://backend.tyto-design.de/api/health | jq .
```

2. **Backend API health** (local dev):

```bash
curl -s http://localhost:3001/api/health | jq .
```

3. **PM2 process status** (production via SSH):

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "su - multibase -s /bin/bash -c 'pm2 list'"
```

4. **Docker containers** (production via SSH):

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | head -40"
```

5. **Redis ping** (production via SSH):

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "redis-cli ping"
```

6. **Disk usage** (production via SSH):

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "df -h / /opt && du -sh /opt/multibase/dashboard/backend/data/ /opt/multibase/shared/volumes/ 2>/dev/null"
```

7. **Backend memory/CPU** (production via SSH):

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "su - multibase -s /bin/bash -c 'pm2 show multibase-backend'"
```

## Summarize results

After running all checks, summarize:

- ✅ OK items
- ⚠️ Warning items (e.g. high memory, containers restarting)
- ❌ Error items (down services, failed health checks)

Suggest fixes for any issues found.
