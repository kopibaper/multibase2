# Multibase2 – Claude Code Reference

## Project Overview

Multibase is a **Single Pane of Glass** management platform for self-hosted Supabase instances.  
It manages multiple Supabase Docker deployments through a single dashboard with shared infrastructure.

**Live demo**: https://multibase.tyto-design.de  
**Active branch**: `Feature_Roadmap` (v3.0.x)

---

## Architecture

```
multibase2/
├── dashboard/
│   ├── backend/          Node.js 20 + Express + TypeScript + Prisma (SQLite)
│   └── frontend/         React 19 + Vite + Tailwind CSS 4
├── shared/               Shared Docker infra (PostgreSQL, Studio, Nginx gateway)
├── projects/             Individual Supabase instance directories
├── e2e/                  Playwright end-to-end tests
└── .claude/              Claude Code config (skills, agents, settings)
```

**Backend**: `http://localhost:3001`  
**Frontend**: `http://localhost:5173`

---

## Common Commands

### Development

```bash
# Backend
cd dashboard/backend && npm run dev        # tsx watch (hot reload)

# Frontend
cd dashboard/frontend && npm run dev       # Vite dev server

# Run both (from root if workspaces configured)
npm run dev:backend
npm run dev:frontend
```

### Build & Type-check

```bash
cd dashboard/backend && npm run build      # tsc → dist/
cd dashboard/frontend && npm run build     # tsc + vite build → dist/

# Type check only (faster)
cd dashboard/backend && npx tsc --noEmit
cd dashboard/frontend && npx tsc --noEmit
```

### Database

```bash
# Prisma
cd dashboard/backend
npx prisma migrate dev            # Create + apply new migration
npx prisma migrate deploy         # Apply pending migrations (production)
npx prisma generate               # Regenerate client after schema change
npx prisma studio                 # GUI at http://localhost:5555

# Direct SQLite
sqlite3 dashboard/backend/prisma/data/multibase.db
sqlite3 dashboard/backend/prisma/data/multibase.db ".tables"
sqlite3 dashboard/backend/prisma/data/multibase.db "SELECT * FROM User LIMIT 5;"
```

### Testing

```bash
# Backend unit tests (Vitest)
cd dashboard/backend && npm test
cd dashboard/backend && npm run test:watch
cd dashboard/backend && npm run test:coverage

# Frontend component tests (Vitest + Testing Library)
cd dashboard/frontend && npm test

# End-to-end tests (Playwright)
cd e2e && npx playwright test
cd e2e && npx playwright test --ui          # interactive UI
cd e2e && npx playwright show-report       # HTML report
```

### Code Quality

```bash
# Format (Prettier)
npx prettier --write dashboard/backend/src/
npx prettier --write dashboard/frontend/src/

# Lint
cd dashboard/frontend && npm run lint
cd dashboard/backend && npm run lint

# Security audit
cd dashboard/backend && npm audit --audit-level=high
cd dashboard/frontend && npm audit --audit-level=high
```

---

## Production (VPS)

**SSH access**:

```bash
ssh -i ~/.ssh/id_ed25519_vps1 root@85.114.138.116
```

**PM2 management**:

```bash
pm2 list
pm2 restart multibase-backend
pm2 logs multibase-backend --lines 100
pm2 logs multibase-backend --nostream
```

**Log files**:

```bash
tail -f /opt/multibase/logs/backend-out-0.log
tail -f /opt/multibase/logs/backend-error-0.log
```

**Production database**:

```bash
sqlite3 /opt/multibase/dashboard/backend/data/multibase.db
```

**Deployment**: Push to `Feature_Roadmap` → GitHub Actions CI auto-deploys frontend + backend.

---

## Authentication Patterns

Two auth methods accepted on all protected routes:

| Method        | Header          | Format           |
| ------------- | --------------- | ---------------- |
| Session token | `Authorization` | `Bearer <token>` |
| API Key       | `X-Api-Key`     | `mb_<hex>`       |

**Roles**: `admin` > `user` > `viewer`  
**Org roles**: `owner` > `admin` > `member` > `viewer`  
**Scopes**: `instances:read`, `backups:create`, `*` (wildcard), etc.

Middleware chain example:

```typescript
router.get(
  '/',
  requireViewer,
  requireOrgRole('viewer'),
  requireScope(SCOPES.INSTANCES.READ),
  handler
);
```

---

## Key File Paths

| What             | Path                                                          |
| ---------------- | ------------------------------------------------------------- |
| Express app init | `dashboard/backend/src/server.ts`                             |
| Auth middleware  | `dashboard/backend/src/middleware/authMiddleware.ts`          |
| Rate limiting    | `dashboard/backend/src/middleware/rateLimiter.ts`             |
| Audit logging    | `dashboard/backend/src/middleware/auditLog.ts`                |
| Input validation | `dashboard/backend/src/middleware/validate.ts` + `schemas.ts` |
| Auth service     | `dashboard/backend/src/services/AuthService.ts`               |
| Prisma schema    | `dashboard/backend/prisma/schema.prisma`                      |
| API scopes       | `dashboard/backend/src/constants/scopes.ts`                   |
| React entry      | `dashboard/frontend/src/main.tsx`                             |
| Auth context     | `dashboard/frontend/src/contexts/AuthContext.tsx`             |
| API client       | `dashboard/frontend/src/lib/`                                 |

---

## Security Architecture

- **Helmet**: Security headers on all responses
- **CORS**: Configured via `CORS_ORIGIN` env var (comma-separated origins)
- **Rate limiting**: Per-endpoint (login: 5/15min, register: 3/hr) — Redis-backed in production
- **Input validation**: Zod schemas on all mutating routes
- **Password**: bcryptjs (10 rounds), enforced complexity via Zod
- **API keys**: SHA-256 hashed, never stored plaintext
- **Credentials**: AES-256-GCM encryption (backup destinations, AI API keys)
- **Audit log**: All state-changing operations recorded in `AuditLog` table
- **2FA**: TOTP via otplib

---

## Environment Variables

```bash
# Required
PORT=3001
DATABASE_URL="file:./prisma/data/multibase.db"
SESSION_SECRET=<random-32-bytes>
REDIS_URL=redis://localhost:6379

# Deployment
DEPLOYMENT_MODE=local            # local | cloud
CORS_ORIGIN=http://localhost:5173
PROJECTS_PATH=../../projects

# Optional
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
COOKIE_DOMAIN=.example.com       # for cross-subdomain auth
LOG_LEVEL=info                   # debug | info | warn | error
```

---

## Testing Architecture

- **Backend unit tests**: Vitest + Supertest (`dashboard/backend/src/__tests__/`)
- **Frontend component tests**: Vitest + Testing Library (`dashboard/frontend/src/__tests__/`)
- **E2E tests**: Playwright (`e2e/`)
- Test database: Separate SQLite file via `DATABASE_URL` env override in tests

---

## Spec-Driven Development

New features follow this workflow:

```
/spec → docs/specs/<feature>.md + OpenAPI stub
spec-writer agent → expand spec with full acceptance criteria + test cases
implement → code against spec
api-contract-checker agent → verify no drift
commit feat: ... → commitlint enforces conventional format
PR → template checklist confirms spec + tests updated
```

Key files:

- `dashboard/backend/openapi.yaml` — OpenAPI 3.1 spec (validate: `npx @redocly/cli lint`)
- `docs/specs/` — feature specs (one file per feature)
- `commitlint.config.mjs` — commit format rules (`feat/fix/docs/chore/...`)

Commit message format: `type(scope): subject` — e.g. `feat(instances): add pause endpoint`

---

## CI/CD

| Workflow             | Trigger                     | What it does                                          |
| -------------------- | --------------------------- | ----------------------------------------------------- |
| `deploy.yml`         | Push to `Feature_Roadmap`   | Build + rsync frontend to VPS1                        |
| `deploy-backend.yml` | Push to `Feature_Roadmap`   | rsync backend → npm ci → prisma migrate → pm2 restart |
| `test.yml`           | PRs to main/Feature_Roadmap | Run all tests + OpenAPI lint + coverage               |
| `release-please.yml` | Push to `main`              | Auto-generate CHANGELOG + GitHub release              |
| `release.yml`        | Manual                      | Manual version bump                                   |
