---
name: logs
description: Stream and inspect production logs via SSH (PM2, Nginx, Docker)
---

Show production logs for the Multibase backend running on VPS (85.114.138.116).

## Steps

1. Ask the user what they want to see:
   - **PM2 backend logs** (default) – last 100 lines of stdout + stderr
   - **Nginx access/error logs** – last 50 lines
   - **Docker instance logs** – ask which project name
   - **Live tail** – stream logs in real time

2. Run the appropriate SSH command:

**PM2 backend logs (stdout + stderr)**:

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "tail -100 /opt/multibase/logs/backend-out-0.log && echo '=== ERRORS ===' && tail -50 /opt/multibase/logs/backend-error-0.log"
```

**PM2 via pm2 CLI**:

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "su - multibase -s /bin/bash -c 'pm2 logs multibase-backend --lines 100 --nostream 2>&1'"
```

**Nginx logs**:

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "tail -50 /var/log/nginx/access.log && echo '=== ERRORS ===' && tail -50 /var/log/nginx/error.log"
```

**Docker instance logs** (replace `<PROJECT_NAME>`):

```bash
ssh -i ~/.ssh/id_ed25519_vps1 -o StrictHostKeyChecking=no root@85.114.138.116 \
  "docker logs <PROJECT_NAME>-kong --tail 50 2>&1"
```

3. Analyze the output for errors, warnings, or patterns relevant to the user's question.
4. Highlight any ERROR or WARN lines and summarize findings.

## Notes

- SSH key path on Linux: `~/.ssh/id_ed25519_vps1`
- PM2 log files: `/opt/multibase/logs/backend-out-0.log` and `backend-error-0.log`
- All project Docker containers are prefixed with the project name
