# PM2 Process Manager

Keep your Multibase backend running reliably with PM2.

## Installation

```bash
sudo npm install -g pm2
```

## Starting Multibase

```bash
cd /opt/multibase/dashboard/backend

# Start the application
pm2 start dist/server.js --name "multibase-backend"
```

## Essential Commands

| Command                         | Description            |
| ------------------------------- | ---------------------- |
| `pm2 list`                      | Show all processes     |
| `pm2 logs`                      | View real-time logs    |
| `pm2 logs multibase-backend`    | View specific app logs |
| `pm2 restart multibase-backend` | Restart app            |
| `pm2 stop multibase-backend`    | Stop app               |
| `pm2 delete multibase-backend`  | Remove app             |

## Auto-Start on Reboot

```bash
# Save current process list
pm2 save

# Generate startup script
pm2 startup

# Follow the command it outputs (run as sudo)
```

## Advanced Configuration

Create `ecosystem.config.js` in your backend folder:

```javascript
module.exports = {
  apps: [
    {
      name: 'multibase-backend',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
```

Start with config:

```bash
pm2 start ecosystem.config.js
```

## Monitoring

### Real-time Dashboard

```bash
pm2 monit
```

### Process Details

```bash
pm2 show multibase-backend
```

### Memory & CPU

```bash
pm2 list
```

## Log Management

### View Logs

```bash
# All logs
pm2 logs

# Last 100 lines
pm2 logs --lines 100

# JSON format
pm2 logs --json
```

### Log Rotation

Install log rotation:

```bash
pm2 install pm2-logrotate

# Configure
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Updating Your App

After deploying new code:

```bash
cd /opt/multibase/dashboard/backend
npm install
npm run build
pm2 restart multibase-backend
```

## Troubleshooting

### App Keeps Crashing

```bash
# Check logs for errors
pm2 logs multibase-backend --lines 200

# Check restart count
pm2 list
```

### Memory Issues

```bash
# Restart if memory exceeds limit
pm2 restart multibase-backend --max-memory-restart 500M
```

### Process Not Starting

```bash
# Delete and re-add
pm2 delete multibase-backend
pm2 start dist/server.js --name "multibase-backend"
pm2 save
```
