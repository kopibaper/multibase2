---
name: deploy
description: Deploy Multibase frontend and/or backend to production via GitHub Actions or manual SSH
---

Deploy the current branch to production.

## Steps

1. **Check current state**:

```bash
git status
git log --oneline -5
git branch --show-current
```

2. **Verify branch** – deployment is triggered from `Feature_Roadmap`:
   - If on another branch, ask user if they want to merge/push there.

3. **Run CI deploy** (push triggers GitHub Actions):

```bash
git push origin Feature_Roadmap
```

4. **Monitor the workflow**:

```bash
GH_REPO=skipper159/multibase2 gh run list --limit 5
GH_REPO=skipper159/multibase2 gh run watch
```

5. **Verify production after deploy**:

Check PM2 status:

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "su - multibase -s /bin/bash -c 'pm2 list'"
```

Check backend health endpoint:

```bash
curl -s https://backend.tyto-design.de/api/health | jq .
```

Check frontend:

```bash
curl -s -o /dev/null -w "%{http_code}" https://multibase.tyto-design.de
```

## What the CI does

- **deploy.yml**: `npm ci` → `npm run build` → rsync `dist/` to VPS1 via SSH
- **deploy-backend.yml**: rsync backend source → `npm ci` → `npx prisma migrate deploy` → `npm run build` → `pm2 restart multibase-backend`

## Manual backend deploy (emergency)

```bash
ssh -i ~/.ssh/id_ed25519_vps1 root@85.114.138.116
cd /opt/multibase/dashboard/backend
npm ci --omit=dev
npx prisma migrate deploy
npm run build
pm2 restart multibase-backend
pm2 logs multibase-backend --lines 20 --nostream
```
