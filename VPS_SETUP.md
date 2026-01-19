# Split Hosting Deployment Guide

This guide explains how to deploy the Multibase Dashboard across two VPS instances as configured.

## Architecture

- **VPS 1 (Frontend):** `46.228.205.184` - Domain: `supabase.tyto-design.de`
- **VPS 2 (Backend):** `85.114.138.116` - Domain: `backend.tyto-design.de`

---

## Part 1: Frontend Deployment (VPS 1)

**Goal:** Host the static React application files.

### 1. Build the Frontend (Locally)

Run this on your local machine to generate the production build using the new `.env.production` configuration.

```bash
cd dashboard/frontend
npm run build
```

This will create a `dist/` folder.

### 2. Upload Files

Upload the contents of the `dist/` folder to VPS 1.

- **Destination:** `/var/www/multibase-dashboard` (Create this directory first)

### 3. Nginx Configuration (VPS 1)

Create a new Nginx configuration file: `/etc/nginx/sites-available/supabase.tyto-design.de`

```nginx
server {
    server_name supabase.tyto-design.de;
    listen 80;

    root /var/www/multibase-dashboard;
    index index.html;

    # React Router Support - Rewrite all requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### 4. Enable & SSL

```bash
# Link the config
sudo ln -s /etc/nginx/sites-available/supabase.tyto-design.de /etc/nginx/sites-enabled/

# Test and Reload
sudo nginx -t
sudo systemctl reload nginx

# Enable HTTPS (Certbot)
sudo certbot --nginx -d supabase.tyto-design.de
```

---

## Part 2: Backend Deployment (VPS 2)

**Goal:** Run the Node.js API and manage Docker containers.

### 1. Prepare VPS 2

Ensure Docker and Node.js (v20+) are installed.

### 2. Upload Backend Files

Copy the entire `multibase` folder (or just `dashboard/backend` and `projects`) to VPS 2.

- **Recommended Path:** `/opt/multibase`

### 3. Setup Backend

```bash
cd /opt/multibase/dashboard/backend

# Install dependencies
npm install --production

# Copy Production Config
cp .env.production .env

# Initialize Database
npx prisma generate
npx prisma migrate deploy

# Start the Server (using PM2 is recommended for production)
npm install -g pm2
pm2 start dist/server.js --name "multibase-backend"
pm2 save
pm2 startup
```

### 4. Nginx Configuration (VPS 2)

Create a new Nginx configuration file: `/etc/nginx/sites-available/backend.tyto-design.de`

```nginx
server {
    server_name backend.tyto-design.de;
    listen 80;

    # Main API Proxy
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Forward Real IP
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. Enable & SSL

```bash
# Link the config
sudo ln -s /etc/nginx/sites-available/backend.tyto-design.de /etc/nginx/sites-enabled/

# Test and Reload
sudo nginx -t
sudo systemctl reload nginx

# Enable HTTPS (Certbot)
sudo certbot --nginx -d backend.tyto-design.de
```

---

## Verification

1.  Open `https://supabase.tyto-design.de` in your browser.
2.  The Frontend should load.
3.  Open the Network tab (F12) and check that requests are going to `https://backend.tyto-design.de/...`.
4.  Ensure you can log in and see your instances.
