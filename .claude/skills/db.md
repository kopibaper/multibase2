---
name: db
description: Database operations – Prisma migrations, SQLite queries, audit logs, active sessions
---

Perform database operations for Multibase (SQLite via Prisma).

**DB path (local dev)**: `dashboard/backend/prisma/data/multibase.db`  
**DB path (production)**: `/opt/multibase/dashboard/backend/data/multibase.db`

## Common Operations

### Run pending migrations

```bash
cd dashboard/backend && npx prisma migrate deploy
```

### Create new migration (dev only)

```bash
cd dashboard/backend && npx prisma migrate dev --name <migration-name>
```

### Regenerate Prisma client after schema change

```bash
cd dashboard/backend && npx prisma generate
```

### Open Prisma Studio (GUI)

```bash
cd dashboard/backend && npx prisma studio
```

### Show all tables

```bash
sqlite3 dashboard/backend/prisma/data/multibase.db ".tables"
```

### Show recent audit logs

```bash
sqlite3 dashboard/backend/prisma/data/multibase.db \
  "SELECT datetime(createdAt/1000, 'unixepoch') as time, action, resource, success, ipAddress FROM AuditLog ORDER BY createdAt DESC LIMIT 20;"
```

### Show recent failed logins

```bash
sqlite3 dashboard/backend/prisma/data/multibase.db \
  "SELECT datetime(createdAt/1000, 'unixepoch') as time, action, details, ipAddress FROM AuditLog WHERE action='USER_LOGIN' AND success=0 ORDER BY createdAt DESC LIMIT 20;"
```

### Show active sessions

```bash
sqlite3 dashboard/backend/prisma/data/multibase.db \
  "SELECT s.id, u.email, u.role, datetime(s.expiresAt/1000, 'unixepoch') as expires, s.ipAddress FROM Session s JOIN User u ON s.userId=u.id WHERE s.expiresAt > unixepoch()*1000 ORDER BY s.createdAt DESC LIMIT 20;"
```

### Show all users

```bash
sqlite3 dashboard/backend/prisma/data/multibase.db \
  "SELECT id, email, username, role, isActive, createdAt FROM User;"
```

### Show API keys (without secrets)

```bash
sqlite3 dashboard/backend/prisma/data/multibase.db \
  "SELECT id, name, prefix, scopes, expiresAt, usageCount, lastUsedAt FROM ApiKey WHERE isActive=1;"
```

### Show instances

```bash
sqlite3 dashboard/backend/prisma/data/multibase.db \
  "SELECT name, status, deploymentMode, basePort, createdAt FROM Instance ORDER BY createdAt DESC;"
```

## Production DB (via SSH)

```bash
ssh -i ~/.ssh/id_ed25519_vps1 root@85.114.138.116 \
  "sqlite3 /opt/multibase/dashboard/backend/data/multibase.db 'SELECT email, role FROM User;'"
```
