# Choosing a VPS Hosting Provider

This guide helps you select and order a Virtual Private Server (VPS) for running Multibase.

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
3. **Image:** Select `Ubuntu 22.04`
4. **Type:** Choose based on your needs:
   - **CX21** (2 vCPU, 4 GB RAM) - 1-2 instances
   - **CX31** (2 vCPU, 8 GB RAM) - 3-5 instances
   - **CX41** (4 vCPU, 16 GB RAM) - 5-10 instances

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

# Create a non-root user (optional but recommended)
adduser multibase
usermod -aG sudo multibase

# Reboot to apply updates
reboot
```

## Next Steps

Once your VPS is ready, proceed to:

1. [Linux Basics](/setup/server-setup/linux-basics) - Initial server hardening
2. [Installing Dependencies](/setup/server-setup/dependencies) - Docker, Node.js, etc.
