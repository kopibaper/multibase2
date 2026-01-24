# DNS Settings for Dynamic Subdomains

Configure DNS to support dynamic subdomains for your Supabase instances.

## Why Wildcard DNS?

Each Supabase instance can have its own subdomain:

- `project-a.instances.yourdomain.com`
- `project-b.instances.yourdomain.com`

Instead of adding DNS records for each project, use a **wildcard record**.

## Setting Up Wildcard DNS

### Option 1: Standard Wildcard Record

Add this DNS record:

| Type | Name          | Value            | TTL  |
| ---- | ------------- | ---------------- | ---- |
| A    | `*.instances` | `YOUR_SERVER_IP` | 3600 |

This routes ALL subdomains of `instances.yourdomain.com` to your server.

### Option 2: Cloudflare Wildcard

In Cloudflare:

1. Go to DNS → Add Record
2. Type: `A`
3. Name: `*.instances`
4. IPv4 address: `YOUR_SERVER_IP`
5. Proxy status: **DNS only** (gray cloud)

## Nginx Configuration for Wildcards

Your Nginx config needs to handle wildcard subdomains:

```nginx
server {
    server_name ~^(?<subdomain>.+)\.instances\.yourdomain\.com$;
    listen 80;

    location / {
        # Route based on subdomain
        proxy_pass http://localhost:3001;
        proxy_set_header X-Subdomain $subdomain;
        proxy_set_header Host $host;
    }
}
```

## SSL for Wildcard Domains

### Using Certbot with DNS Challenge

Wildcard certificates require DNS validation:

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  -d "*.instances.yourdomain.com" \
  -d "instances.yourdomain.com"
```

You'll be prompted to add a TXT record. Follow the instructions.

### Using Cloudflare for Automatic SSL

If using Cloudflare, their free plan includes:

- Universal SSL for your domain
- Wildcard support on paid plans

## Verifying DNS Setup

```bash
# Test main domain
dig multibase.yourdomain.com +short

# Test wildcard
dig test.instances.yourdomain.com +short
dig another.instances.yourdomain.com +short

# Both should return your server IP
```

## Common DNS Issues

| Problem           | Solution                                              |
| ----------------- | ----------------------------------------------------- |
| DNS not resolving | Wait for propagation (up to 48h)                      |
| Wrong IP returned | Check for conflicting records                         |
| SSL errors        | Ensure Cloudflare proxy is off or properly configured |
| WebSocket fails   | Disable Cloudflare proxy for that subdomain           |

## Next Steps

- [Nginx Configuration](/setup/configuration/nginx) - Configure reverse proxy
- [Single Server Deployment](/setup/deployment/single-server) - Complete setup
