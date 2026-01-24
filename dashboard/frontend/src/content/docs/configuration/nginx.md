# Nginx Configuration

Configure Nginx as a reverse proxy for Multibase.

## Basic Configuration

Create `/etc/nginx/sites-available/multibase`:

```nginx
server {
    server_name multibase.yourdomain.com;
    listen 80;

    # Frontend static files
    root /var/www/multibase;
    index index.html;

    # React Router - all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for long requests
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

## Enable Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/multibase /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## SSL with Certbot

```bash
# Install SSL certificate
sudo certbot --nginx -d multibase.yourdomain.com

# Certificate auto-renewal (already configured by Certbot)
sudo certbot renew --dry-run
```

After SSL, your config will be updated with HTTPS settings:

```nginx
server {
    server_name multibase.yourdomain.com;
    listen 443 ssl;

    ssl_certificate /etc/letsencrypt/live/multibase.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/multibase.yourdomain.com/privkey.pem;

    # ... rest of config
}

server {
    listen 80;
    server_name multibase.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

## Performance Optimization

Add to `/etc/nginx/nginx.conf` in the `http` block:

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml application/json application/javascript application/xml;

# Client body size (for file uploads)
client_max_body_size 100M;

# Connection keep-alive
keepalive_timeout 65;
```

## Troubleshooting

### Common Errors

| Error                | Cause               | Solution                        |
| -------------------- | ------------------- | ------------------------------- |
| 502 Bad Gateway      | Backend not running | Check `pm2 status`              |
| 504 Gateway Timeout  | Backend too slow    | Increase `proxy_read_timeout`   |
| 413 Entity Too Large | Upload too big      | Increase `client_max_body_size` |

### Useful Commands

```bash
# Test config
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log

# Restart Nginx
sudo systemctl restart nginx
```

## Next Steps

- [PM2 Configuration](/setup/configuration/pm2)
