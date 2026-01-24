# Installing Dependencies

Install all required software for running Multibase Dashboard.

## Docker & Docker Compose

Docker is required to run Supabase instances.

```bash
# Remove old versions
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null

# Install prerequisites
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# Add Docker's GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add your user to docker group (logout/login required)
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version
```

## Node.js 20

Using NodeSource repository for the latest LTS version.

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

## Nginx

Nginx serves as reverse proxy and handles SSL.

```bash
sudo apt install -y nginx

# Enable and start
sudo systemctl enable nginx
sudo systemctl start nginx

# Verify
sudo systemctl status nginx
```

## Certbot (SSL Certificates)

Free SSL certificates from Let's Encrypt.

```bash
sudo apt install -y certbot python3-certbot-nginx
```

## PM2 (Process Manager)

Keeps your Node.js application running and restarts it if it crashes.

```bash
sudo npm install -g pm2

# Verify
pm2 --version
```

## Redis (Optional)

Improves Dashboard performance with caching.

```bash
# Using Docker (recommended)
docker run -d --name redis \
  --restart unless-stopped \
  -p 127.0.0.1:6379:6379 \
  redis:alpine

# Verify
docker ps | grep redis
```

## Verify All Installations

```bash
echo "=== Installation Check ==="
echo "Docker: $(docker --version)"
echo "Docker Compose: $(docker compose version)"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Nginx: $(nginx -v 2>&1)"
echo "PM2: $(pm2 --version)"
echo "=========================="
```

## Next Steps

With all dependencies installed, continue to:

- [Domain Setup](/setup/domain-dns/domain-setup) - Configure your domain
- [Single Server Deployment](/setup/deployment/single-server) - Deploy Multibase
