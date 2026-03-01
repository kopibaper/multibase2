# Choosing a VPS Hosting Provider

This guide helps you select and order a Virtual Private Server (VPS) for running Multibase.

> **Cloud version note:** Multibase runs a shared Docker infrastructure stack (8 containers: PostgreSQL, Studio, Supavisor, Logflare, Vector, meta, imgproxy, nginx-gateway) plus a Redis container. Each Supabase project you create adds another 5 containers (auth, REST, realtime, storage, edge functions). Plan your server size accordingly.

## Recommended Providers

| Provider            | Starting Price | Pros                                         | Cons                 |
| ------------------- | -------------- | -------------------------------------------- | -------------------- |
| **Hetzner**         | ~€4/month      | Excellent price/performance, EU data centers | Limited US locations |
| **DigitalOcean**    | $6/month       | Simple interface, good docs                  | Slightly higher cost |
| **Linode (Akamai)** | $5/month       | Reliable, good support                       | Fewer locations      |
| **Vultr**           | $5/month       | Many locations worldwide                     | Variable performance |
| **Contabo**         | ~€5/month      | Very cheap, lots of RAM                      | Slower support       |

## Ordering a VPS (Hetzner Example)

### Step 1: Create an Account

1. Go to [hetzner.com](https://www.hetzner.com)
2. Click "Cloud" → "Sign Up"
3. Verify your email and add payment method

### Step 2: Create a New Server

1. Click "Add Server"
2. **Location:** Choose closest to your users (e.g., `Nuremberg` for EU)
3. **Image:** Select `Ubuntu 24.04`
4. **Type:** Choose based on your needs:

   | Server | vCPU | RAM | Disk | Price | Supabase instances | Notes |
   | --- | :---: | :---: | :---: | :---: | :---: | --- |
   | **CX21** | 2 | 4 GB | 40 GB | ~€4/mo | 1–2 | Tight — shared stack uses ~1.5 GB at idle |
   | **CX31** | 2 | 8 GB | 80 GB | ~€9/mo | 3–8 | Recommended starting point |
   | **CX41** | 4 | 16 GB | 160 GB | ~€18/mo | 8–20 | Comfortable for production |
   | **CX51** | 8 | 32 GB | 240 GB | ~€35/mo | 20–40 | High-load / many tenants |

   > **RAM breakdown:** Shared infra (8 containers + Redis) uses ~1.5 GB at idle. OS + backend adds ~0.5 GB. Each Supabase instance (5 containers: auth, REST, realtime, storage, edge functions) adds roughly **500–700 MB** under active load.

### Step 3: Configure Access

1. **SSH Key:** Add your public SSH key (recommended)

   ```bash
   # Generate a key if you don't have one
   ssh-keygen -t ed25519 -C "your-email@example.com"

   # Copy the public key
   cat ~/.ssh/id_ed25519.pub
   ```

2. **Name:** Give your server a descriptive name (e.g., `multibase-production`)

### Step 4: Create and Connect

1. Click "Create & Buy"
2. Wait for server to provision (~30 seconds)
3. Copy the IP address
4. Connect via SSH:
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

## First Login Checklist

After connecting to your new server:

```bash
# Update the system
apt update && apt upgrade -y

# Set timezone
timedatectl set-timezone Europe/Berlin

# Reboot to apply kernel/package updates
reboot
```

> You do **not** need to create a `multibase` system user manually — the installer creates it automatically with the correct permissions.

## Next Steps

Once your VPS is ready, run the installer:

```bash
curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/cloud-version/deployment/install.sh | sudo bash
```

See the [Installation Guide](/setup/getting-started/installation) for a full walkthrough.
