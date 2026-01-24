# GitHub Actions CI/CD

Automatically deploy Multibase when you push to the `main` branch.

## Overview

This workflow:

1. Builds the frontend
2. Deploys static files to your frontend server
3. Deploys backend code to your backend server
4. Restarts services

## Prerequisites

- GitHub repository with your Multibase code
- SSH access to your server(s)
- SSH key pair for GitHub Actions

## Step 1: Generate SSH Key

On your local machine:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ./github_deploy_key -N ""
```

This creates:

- `github_deploy_key` (private) → Goes to GitHub Secrets
- `github_deploy_key.pub` (public) → Goes to server

## Step 2: Add Public Key to Server

```bash
# Copy to server
ssh-copy-id -i github_deploy_key.pub user@YOUR_SERVER_IP

# Or manually
cat github_deploy_key.pub | ssh user@YOUR_SERVER_IP "cat >> ~/.ssh/authorized_keys"
```

## Step 3: Configure GitHub Secrets

Go to: **Repository → Settings → Secrets and variables → Actions**

Add these secrets:

| Secret Name       | Value                                      |
| ----------------- | ------------------------------------------ |
| `SSH_HOST`        | Your server IP                             |
| `SSH_USER`        | SSH username (e.g., `root` or `multibase`) |
| `SSH_PRIVATE_KEY` | Contents of `github_deploy_key` file       |
| `SESSION_SECRET`  | Random string for backend sessions         |

## Step 4: Create Workflow File

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy Multibase

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            dashboard/frontend/package-lock.json
            dashboard/backend/package-lock.json

      - name: Build Frontend
        working-directory: dashboard/frontend
        run: |
          npm ci
          echo "VITE_API_URL=https://YOUR_DOMAIN/api" > .env.production
          npm run build

      - name: Deploy to Server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: 'dashboard/frontend/dist/*,dashboard/backend/*'
          target: '/opt/multibase'
          strip_components: 0

      - name: Post-deploy commands
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/multibase/dashboard/backend
            npm ci --production
            npx prisma generate
            npx prisma migrate deploy
            npm run build
            pm2 restart multibase-backend || pm2 start dist/server.js --name multibase-backend

            # Copy frontend to web root
            sudo rsync -av /opt/multibase/dashboard/frontend/dist/ /var/www/multibase/
```

## Step 5: Test Deployment

1. Commit and push the workflow file
2. Go to **Actions** tab in GitHub
3. Watch the deployment run
4. Check your server for updates

## Workflow Customization

### Split Server Deployment

For two servers, use separate jobs:

```yaml
jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      # ... frontend build and deploy to VPS 1

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      # ... backend deploy to VPS 2
```

### Environment-specific Deploys

```yaml
on:
  push:
    branches:
      - main # Production
      - develop # Staging
```

## Troubleshooting

| Issue                 | Solution                                   |
| --------------------- | ------------------------------------------ |
| SSH connection failed | Verify SSH key and server IP in secrets    |
| Build failed          | Check Node.js version and dependencies     |
| PM2 restart failed    | Ensure PM2 is installed globally on server |
| Permission denied     | Check file permissions and user ownership  |

## Next Steps

- [Environment Configuration](/setup/configuration/environment)
- [PM2 Configuration](/setup/configuration/pm2)
