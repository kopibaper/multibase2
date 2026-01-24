# Domain Setup

How to register and configure a domain for your Multibase Dashboard.

## Registering a Domain

If you don't have a domain yet, here are popular registrars:

| Registrar          | Starting Price | Notes                      |
| ------------------ | -------------- | -------------------------- |
| **Namecheap**      | ~$9/year       | Free WhoisGuard privacy    |
| **Cloudflare**     | ~$9/year       | At-cost pricing, great DNS |
| **Google Domains** | ~$12/year      | Simple interface           |
| **Hetzner**        | ~€10/year      | Good if using Hetzner VPS  |

## Domain Structure

For Multibase, you'll typically need:

| Subdomain                      | Purpose                         |
| ------------------------------ | ------------------------------- |
| `multibase.yourdomain.com`     | Main Dashboard                  |
| `api.multibase.yourdomain.com` | Backend API (if split hosting)  |
| `*.instances.yourdomain.com`   | Wildcard for Supabase instances |

## Pointing Domain to Your Server

### Step 1: Find Your Server IP

```bash
# On your server
curl ifconfig.me
```

### Step 2: Configure DNS Records

In your domain registrar's DNS settings, add:

| Type | Name            | Value            | TTL  |
| ---- | --------------- | ---------------- | ---- |
| A    | `multibase`     | `YOUR_SERVER_IP` | 3600 |
| A    | `api.multibase` | `YOUR_SERVER_IP` | 3600 |

### Step 3: Verify DNS Propagation

```bash
# Check if DNS is resolving
dig multibase.yourdomain.com +short

# Or use online tool
# https://dnschecker.org
```

DNS changes can take up to 24-48 hours to propagate globally, but usually complete within minutes.

## Using Cloudflare (Recommended)

Cloudflare provides free DNS with additional benefits:

1. **Create Cloudflare Account** at [cloudflare.com](https://cloudflare.com)
2. **Add Your Domain** → Follow the setup wizard
3. **Update Nameservers** at your registrar to Cloudflare's
4. **Configure DNS** in Cloudflare dashboard

### Cloudflare Settings for Multibase

| Setting              | Recommendation                     |
| -------------------- | ---------------------------------- |
| **Proxy Status**     | DNS only (gray cloud) for main app |
| **SSL/TLS**          | Full (strict)                      |
| **Always Use HTTPS** | On                                 |

> **Important:** For WebSocket support, keep the proxy disabled (gray cloud icon) or ensure WebSocket is enabled in Cloudflare settings.

## Next Steps

- [DNS Settings](/setup/domain-dns/dns-settings) - Configure dynamic subdomains
- [Single Server Deployment](/setup/deployment/single-server) - Deploy Multibase
