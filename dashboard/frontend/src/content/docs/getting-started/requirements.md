# System Requirements

Before installing Multibase, ensure your server meets these minimum requirements.

## Per Supabase Instance

Each Supabase instance you create will require resources. Plan accordingly based on how many instances you need.

| Resource    | Minimum   | Recommended |
| ----------- | --------- | ----------- |
| **CPU**     | 2 vCPU    | 4 vCPU      |
| **RAM**     | 4 GB      | 8 GB        |
| **Storage** | 20 GB SSD | 50 GB+ SSD  |
| **Network** | 100 Mbps  | 1 Gbps      |

> **Note:** These are per-instance requirements. The Dashboard itself adds minimal overhead (~256 MB RAM, 1 vCPU).

## For the Dashboard Server

| Component          | Requirement                                 |
| ------------------ | ------------------------------------------- |
| **OS**             | Ubuntu 22.04 LTS (recommended) or Debian 12 |
| **Node.js**        | v20 or higher                               |
| **Docker**         | v24 or higher                               |
| **Docker Compose** | v2.20 or higher                             |
| **Nginx**          | Latest stable                               |

## Software Dependencies

The following will be installed during setup:

- **Node.js 20+** - Runtime for the Dashboard
- **Docker & Docker Compose** - Container management for Supabase instances
- **Nginx** - Reverse proxy and SSL termination
- **Certbot** - Free SSL certificates via Let's Encrypt
- **PM2** - Process manager for Node.js (production)
- **Redis** (optional) - Caching layer for improved performance

## Network Requirements

- **Open Ports:**
  - `22` - SSH access
  - `80` - HTTP (redirects to HTTPS)
  - `443` - HTTPS
  - `3001` - Dashboard API (internal, proxied via Nginx)
  - `5173` - Dashboard Frontend dev server (development only)

- **Domain:** A registered domain name with DNS access
- **SSL:** Required for production (auto-configured with Certbot)
