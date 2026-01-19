# GitHub Actions Deployment Setup

This workflow automatically deploys your updates to both servers whenever you push to the `main` branch.

## 1. Get Your Server Credentials

You will need SSH access keys (ed25519 or rsa) for both servers. Ideally, generate a new pair specifically for GitHub Actions:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ./github_deploy_key
```

- `github_deploy_key` (Private Key): Goes into GitHub Secrets.
- `github_deploy_key.pub` (Public Key): Needs to be added to `~/.ssh/authorized_keys` on **BOTH** VPS 1 and VPS 2.

## 2. Configure GitHub Secrets

Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.

Add the following secrets:

### VPS 1 (Frontend)

| Secret Name    | Value                      | Description                                   |
| :------------- | :------------------------- | :-------------------------------------------- |
| `VPS1_HOST`    | `46.228.205.184`           | IP Address of Frontend Server                 |
| `VPS1_USER`    | `root` (or your user)      | SSH Username                                  |
| `VPS1_SSH_KEY` | _(Content of private key)_ | Private SSH Key (begins with `-----BEGIN...`) |

### VPS 2 (Backend)

| Secret Name      | Value                      | Description                                        |
| :--------------- | :------------------------- | :------------------------------------------------- |
| `VPS2_HOST`      | `85.114.138.116`           | IP Address of Backend Server                       |
| `VPS2_USER`      | `root` (or your user)      | SSH Username                                       |
| `VPS2_SSH_KEY`   | _(Content of private key)_ | Private SSH Key                                    |
| `SESSION_SECRET` | _(Random String)_          | Secret for backend sessions (e.g. `g78s6g876s...`) |

## 3. Workflow Details

### Frontend Job

1.  Checks out code.
2.  Installs dependencies (`npm ci`).
3.  Builds the project with `VITE_API_URL=https://backend.tyto-design.de`.
4.  Deploys **only** the `dist` folder to `/var/www/multibase-dashboard` on VPS 1.

### Backend Job

1.  Checks out code.
2.  Deploys the repository to `/opt/multibase` on VPS 2.
3.  Connects via SSH to run post-deploy commands:
    - Installs dependencies.
    - Generates `.env` file dynamically (ensuring consistent config).
    - Runs Prisma database migrations.
    - Builds TypeScript.
    - Restarts the PM2 process.

## 4. First Run

1.  Commit and push the `.github/workflows/deploy.yml` file.
2.  Go to the "Actions" tab in GitHub to watch the deployment.
