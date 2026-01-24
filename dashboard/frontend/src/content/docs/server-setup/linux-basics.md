# Linux Server Basics

Essential setup steps for a fresh Ubuntu/Debian server before installing Multibase.

## Initial Security Setup

### Update System Packages

```bash
sudo apt update && sudo apt upgrade -y
```

### Configure Firewall (UFW)

```bash
# Install UFW if not present
sudo apt install ufw -y

# Allow essential ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Create a Non-Root User

Running as root is not recommended for production.

```bash
# Create user
sudo adduser multibase

# Add to sudo group
sudo usermod -aG sudo multibase

# Copy SSH keys to new user
sudo mkdir -p /home/multibase/.ssh
sudo cp ~/.ssh/authorized_keys /home/multibase/.ssh/
sudo chown -R multibase:multibase /home/multibase/.ssh
sudo chmod 700 /home/multibase/.ssh
sudo chmod 600 /home/multibase/.ssh/authorized_keys

# Test login in new terminal before disconnecting
ssh multibase@YOUR_SERVER_IP
```

### Secure SSH Access

Edit `/etc/ssh/sshd_config`:

```bash
sudo nano /etc/ssh/sshd_config
```

Recommended settings:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Restart SSH:

```bash
sudo systemctl restart sshd
```

## Install Essential Tools

```bash
# Basic utilities
sudo apt install -y curl wget git htop nano unzip

# Build essentials (for native Node modules)
sudo apt install -y build-essential
```

## Configure Timezone

```bash
# List available timezones
timedatectl list-timezones | grep Europe

# Set timezone
sudo timedatectl set-timezone Europe/Berlin

# Verify
date
```

## Enable Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Check System Resources

```bash
# Memory
free -h

# Disk space
df -h

# CPU info
nproc

# Running processes
htop
```

## Next Steps

Your server is now secured and ready. Continue with:

- [Installing Dependencies](/setup/server-setup/dependencies)
