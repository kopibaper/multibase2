# Environment Configuration

Complete reference for all environment variables in Multibase.

## Backend `.env` File

Location: `dashboard/backend/.env`

### Server Settings

| Variable   | Default       | Description                                |
| ---------- | ------------- | ------------------------------------------ |
| `PORT`     | `3001`        | API server port                            |
| `NODE_ENV` | `development` | Environment: `development` or `production` |

### Database

| Variable       | Default                    | Description          |
| -------------- | -------------------------- | -------------------- |
| `DATABASE_URL` | `file:./data/multibase.db` | SQLite database path |

### Docker

| Variable      | Default  | Description        |
| ------------- | -------- | ------------------ |
| `DOCKER_HOST` | (varies) | Docker socket path |

**Values by OS:**

- **Linux:** `unix:///var/run/docker.sock`
- **Windows:** `npipe:////./pipe/docker_engine`
- **macOS:** `unix:///var/run/docker.sock`

### Paths

| Variable        | Default          | Description                         |
| --------------- | ---------------- | ----------------------------------- |
| `PROJECTS_PATH` | `../../projects` | Where Supabase instances are stored |

### Security

| Variable         | Required | Description                                         |
| ---------------- | -------- | --------------------------------------------------- |
| `SESSION_SECRET` | Yes      | Random string (min 32 chars) for session encryption |
| `CORS_ORIGIN`    | Yes      | Allowed origins (comma-separated)                   |

### SMTP (Email)

| Variable    | Default | Description          |
| ----------- | ------- | -------------------- |
| `SMTP_HOST` | -       | SMTP server hostname |
| `SMTP_PORT` | `587`   | SMTP port            |
| `SMTP_USER` | -       | SMTP username        |
| `SMTP_PASS` | -       | SMTP password        |
| `SMTP_FROM` | -       | "From" address       |

### Application

| Variable  | Default | Description                  |
| --------- | ------- | ---------------------------- |
| `APP_URL` | -       | Public URL (for email links) |

### Intervals

| Variable                | Default | Description                      |
| ----------------------- | ------- | -------------------------------- |
| `METRICS_INTERVAL`      | `15000` | Metrics collection interval (ms) |
| `HEALTH_CHECK_INTERVAL` | `10000` | Health check interval (ms)       |
| `ALERT_CHECK_INTERVAL`  | `60000` | Alert evaluation interval (ms)   |

## Example Production `.env`

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL="file:./data/multibase.db"

# Docker
DOCKER_HOST=unix:///var/run/docker.sock

# Projects
PROJECTS_PATH=/opt/multibase/projects

# Security
SESSION_SECRET=your-very-long-random-string-minimum-32-characters
CORS_ORIGIN=https://multibase.yourdomain.com

# SMTP
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@mg.yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM="Multibase" <noreply@yourdomain.com>

# App URL
APP_URL=https://multibase.yourdomain.com
```

## Frontend `.env.production`

Location: `dashboard/frontend/.env.production`

| Variable       | Description     |
| -------------- | --------------- |
| `VITE_API_URL` | Backend API URL |

```env
VITE_API_URL=https://multibase.yourdomain.com/api
```

## Generating a Session Secret

```bash
# Using openssl
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Next Steps

- [Nginx Configuration](/setup/configuration/nginx)
- [PM2 Configuration](/setup/configuration/pm2)
