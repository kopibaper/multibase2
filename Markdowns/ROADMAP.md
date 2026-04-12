# Multibase Roadmap — Feature Comparison with Supabase

> Based on a comprehensive analysis of the Supabase docs and the current Multibase feature set (v1.0–v1.7).
> As of: March 2026 | Last updated: April 9, 2026

---

## Current Status — What Multibase Already Covers

| Area | Status | Version |
|---|---|---|
| Multi-Instance Docker Orchestration | ✅ Complete | v1.0 |
| Auth & Session Management (JWT, Bcrypt, 2FA) | ✅ Complete | v1.0 / v1.1 |
| Backup & Restore (incl. S3, Scheduling, PITR) | ✅ Complete | v1.1 |
| Monitoring, Alerts, Audit Logs | ✅ Complete | v1.1 |
| Storage Manager (Upload, Signed URLs, Folders) | ✅ Complete | v1.2 |
| Instance Cloning & Snapshots | ✅ Complete | v1.2 |
| Cloud Architecture (Shared Services, ~75% RAM savings) | ✅ Complete | v1.3 |
| Kong → Nginx Gateway Migration | ✅ Complete | v1.3 |
| AI Chat Agent (30+ Tools, Multi-Provider) | ✅ Complete | v1.3 |
| Workspace Page (Studio, API Keys, SMTP) | ✅ Complete | v1.3 |
| Multi-Tenancy / Organizations / RBAC | ✅ Complete | v1.4 |
| One-Click Install + SSL + PM2 | ✅ Complete | v1.0+ |
| GraphQL API Playground (pg_graphql) | ✅ Complete | v1.5 |
| Database Webhooks (pg_net) | ✅ Complete | v1.5 |
| Cron Job Manager (pg_cron) | ✅ Complete | v1.5 |
| AI & Vectors — pgvector (Extensions, Columns, Indexes, Search) | ✅ Complete | v1.5 |
| Message Queues (pgmq) | ✅ Complete | v1.5 |
| Workspace Redesign (3-Level Nav, Org Selection, Project Grid, Sidebar) | ✅ Complete | v1.5 |
| Auth Tab in Workspace + Auth Extensions (Phone/CAPTCHA/SAML/Templates) | ✅ Complete | **v1.6** |
| Custom Domains per Tenant (DNS Check + Certbot) | ✅ Complete | **v1.6** |
| Environment Labels (Production/Staging/Dev) + Clone Shortcuts | ✅ Done | **v1.6** |
| Storage: Tus Resumable Uploads + Nginx CDN Cache | ✅ Done | **v1.6** |
| Vault Secrets UI (pgsodium/pg_vault) + Documentation | ✅ Done | **v1.6** |
| Network Restrictions (IP Whitelist, SSL Enforcement, Rate Limiting) | ✅ Done | **v1.6** |
| Edge Functions IDE (CodeMirror, TypeScript, Env Vars, Test Runner) | ✅ Complete | **v1.7** |
| Realtime Dashboard (Config, Live Stats, Active Channels, Quick Connect) | ✅ Complete | **v1.7** |
| Log Drains (Webhook Export, json/ndjson/logfmt, 30s Polling, Test Delivery) | ✅ Complete | **v1.7** |
| Read Replicas (External PostgreSQL Registration, Status Monitor, Lag Display) | ✅ Complete | **v1.7** |
| MCP Server (12 Tools, JSON-RPC 2.0, Claude Desktop / Cursor / VS Code) | ✅ Complete | **v1.7** |
| Extension Marketplace (51 Extensions, Categories, Install UI) | ✅ Complete | **v1.8** |
| Feedback System (Public API, Admin Analytics, Voting) | ✅ Complete | **v1.8** |

---

## Missing Features — Supabase vs. Multibase Gap Analysis

### Priority 1 — High Value, Immediately Actionable

#### 1. GraphQL API (pg_graphql)
**Supabase:** Auto-generated GraphQL API via the `pg_graphql` extension. Full CRUD operations, filtering, pagination, relationships — all automatically derived from the DB schema.

**Multibase:** ⚠️ **Partially available** — The `graphql_public` schema is already listed in `ApiTab.tsx` as an exposed schema (`PGRST_DB_SCHEMAS`), but there is no dedicated GraphQL management UI.

**Proposal:**
- Dedicated GraphQL section in the dashboard UI (show endpoint, test it)
- Embed a GraphQL Playground / Explorer
- Make Nginx Gateway routing explicitly configurable per tenant

**Effort:** Low | **Impact:** High

---

#### 2. Database Webhooks (pg_net)
**Supabase:** On `INSERT`, `UPDATE`, `DELETE` events, HTTP webhooks (POST/GET) are automatically sent to external services asynchronously via the `pg_net` extension.

**Multibase:** No webhook management available.

**Proposal:**
- Dashboard UI for creating/managing database webhooks per tenant
- Extension already exists in the Supabase Postgres fork
- UI + API endpoints for CRUD of webhook triggers

**Effort:** Low | **Impact:** High

---

#### 3. Cron Jobs (pg_cron)
**Supabase:** Built-in cron system for scheduling recurring SQL jobs directly in Postgres. Each job can execute SQL snippets or HTTP requests (from every second to once a year).

**Multibase:** ⚠️ **Available for backups only** — Cron scheduling exists in `BackupManagement.tsx` with cron expressions for automated backups (`SchedulerService.ts`). No general `pg_cron` UI for custom database jobs.

**Proposal:**
- General-purpose Cron Job Manager in the dashboard (Create, Edit, Monitor, Delete)
- `pg_cron` extension is already included in Supabase Postgres
- Job run history with status tracking from `cron.job_run_details`

**Effort:** Medium | **Impact:** High

---

#### 4. Message Queues (pgmq)
**Supabase:** Durable message queues with guaranteed delivery, exactly-once delivery, and message archival via the `pgmq` extension.

**Multibase:** No queue system available.

**Proposal:**
- Queue Manager UI in the dashboard
- Create queues, inspect messages, consumer monitoring
- Particularly useful for background jobs and event-driven architectures

**Effort:** Medium | **Impact:** Medium

---

#### 5. Row Level Security (RLS) Manager
**Supabase:** Visual RLS policy editor in Studio — create and test policies with a few clicks.

**Multibase:** ✅ **Already fully implemented** — `PoliciesTab.tsx` + `CreatePolicyModal.tsx` provide complete RLS management: Enable/Disable per table, policy CRUD with SELECT/INSERT/UPDATE/DELETE, roles (anon, authenticated, service_role), USING & WITH CHECK expressions.

**Status:** ✅ Done — no action needed

---

### Priority 2 — Strategically Important

#### 6. AI & Vectors (pgvector)
**Supabase:** Strong positioning as an AI/vector database:
- Vector columns with `pgvector` extension
- Automatic embeddings
- Semantic search, keyword search, hybrid search
- RAG with permissions
- Integrations: OpenAI, Hugging Face, LangChain, LlamaIndex, Amazon Bedrock

**Multibase:** ⚠️ **AI Chat available, pgvector missing** — AI Chat Agent with multi-provider support (OpenAI, Anthropic, Gemini, OpenRouter) is complete (`AiChatPanel.tsx`, `AiAgentService.ts`). The "Vector" container is Vector.dev (log aggregator), **not** pgvector for embeddings.

**Proposal:**
- Vector Dashboard module: view collections, manage embeddings, test similarity search
- Automatic `pgvector` extension activation per tenant on instance creation
- Template: "AI-Ready Instance" with pre-configured pgvector + example schema
- Integration into the existing AI Chat Agent (vector queries via tool)

**Effort:** Medium | **Impact:** Very high (differentiation)

---

#### 7. Auth Configuration UI (Social Login, Phone, Magic Links, SAML SSO, CAPTCHA)
**Supabase Auth (GoTrue) supports:**
- Social Login: Apple, Google, GitHub, Slack, Discord, Twitter, etc. (30+ providers)
- Phone Login: SMS-based via Twilio/MessageBird
- Magic Links: Passwordless email authentication
- SAML SSO: Enterprise single sign-on
- CAPTCHA: hCaptcha/Turnstile protection
- Auth Hooks: Custom logic on auth events
- Third-Party Auth: Use custom JWT issuers

**Multibase:** ✅ **Social Login already implemented** — `AuthTab.tsx` allows configuration of Google, GitHub, Discord, Facebook, Twitter, GitLab, Bitbucket, Apple via environment variables with automatic service restart.

**Still open (v1.6):**
- Phone Login (SMS via Twilio/MessageBird)
- Magic Link email template customization
- SAML SSO (enterprise feature)
- CAPTCHA integration (hCaptcha/Turnstile)
- Auth Hooks / Third-Party JWT

**Effort:** Medium | **Impact:** Medium (base done, extensions pending)

---

#### 8. Custom Domains / White-Labeling
**Supabase:** Custom domains per project — APIs run under your own domain (e.g. `api.mycompany.com`).

**Multibase:** Not available.

**Proposal:**
- Custom domain management per tenant in the dashboard
- DNS validation (CNAME/TXT record check)
- Automatic SSL certificate generation (Let's Encrypt)
- Nginx Gateway configuration auto-update
- Ideal for agencies wanting to give customers their own domains

**Effort:** Medium | **Impact:** High

---

#### 9. Branching / Environments (Dev/Staging/Prod)
**Supabase:** Database branching — separate database branches for development/testing, automatically created alongside Git branches.

**Multibase:** Instance cloning available, but no environment concept.

**Proposal:**
- Environment management per organization
- "Clone to Staging" button (uses existing cloning feature)
- Branch tracking with Git integration
- Diff view between branch and production schema
- One-click promote to production

**Effort:** High | **Impact:** Medium

---

#### 10. Database Replication & Read Replicas
**Supabase:** Read replicas in multiple regions + replication to external data warehouses.

**Multibase:** Not available.

**Proposal:**
- Replication setup wizard per tenant
- Read replica management in the dashboard (cloud deployments)
- Log-based replication to analytics systems

**Effort:** High | **Impact:** Medium

---

### Priority 3 — Nice-to-Have / Long-Term

#### 11. Supabase Vault (Secrets & Encryption)
Encryption of sensitive data and secrets management directly in Postgres.

**Proposal:** Vault UI in the dashboard — store secrets, manage encrypted columns.

**Effort:** Low | **Impact:** Medium

---

#### 12. SQL Editor in the Dashboard
Supabase Studio has an interactive SQL editor with syntax highlighting, auto-complete, and saved queries.

**Multibase:** ✅ **Already implemented** — A "Quick SQL Editor" is embedded in `SupabaseManager.tsx`. The backend endpoint `POST /api/instances/:name/sql` is functional.

**Open (improvement, low priority):**
- Syntax highlighting (Monaco Editor)
- Saved queries per organization
- Query history and performance analysis

**Effort:** Low (extension) | **Impact:** Medium

---

#### 13. Edge Functions Management UI
Multibase deploys edge functions per tenant, but there is no UI for creating/editing/deploying them.

**Proposal:**
- Code editor (Monaco) in the dashboard
- Deploy button with live logs
- Environment variables management per function
- Function metrics (invocations, errors, latency)

**Effort:** High | **Impact:** Medium

---

#### 14. Log Drains
Supabase allows exporting logs to external providers (Datadog, Grafana Loki, etc.).

**Proposal:**
- Log drain configuration per organization
- Destinations: Datadog, Grafana Loki, Elasticsearch, Webhook
- Filter per service (Auth, REST, DB, Realtime)

**Effort:** Medium | **Impact:** Low

---

#### 15. Realtime Broadcast & Presence Dashboard
Supabase Realtime offers not only DB changes but also broadcast (messages between users) and presence (online status, typing indicators).

**Proposal:**
- Realtime dashboard per tenant: active channels, connected clients
- Broadcast test tool
- Presence visualization

**Effort:** Medium | **Impact:** Low

---

#### 16. Storage CDN & Resumable Uploads
Supabase Storage offers CDN, Smart CDN, resumable uploads (Tus protocol), and S3 compatibility.

**Proposal:**
- CDN layer (Cloudflare/Nginx cache) for storage assets
- Resumable upload support in the Storage Manager
- Expose S3-compatible API per tenant
- Storage metrics (bandwidth, requests, cache hit rate)

**Effort:** Medium | **Impact:** Medium

---

#### 17. Network Restrictions & SSL Enforcement
**Proposal:** Security panel per tenant:
- IP whitelisting for database access
- SSL-only enforcement
- Connection limits
- Rate limiting per tenant

**Effort:** Low | **Impact:** Medium

---

#### 18. Terraform Provider / Infrastructure as Code
**Proposal:**
- Terraform Provider or Pulumi plugin for Multibase
- Declarative instance configuration via YAML
- GitOps workflow: manage instances via a Git repository

**Effort:** High | **Impact:** Medium

---

#### 19. MCP Server (Model Context Protocol)
Supabase offers an MCP Server for AI agents (Claude, ChatGPT, etc.).

**Proposal:** Multibase MCP Server for managing instances, DB queries, backups, and storage via AI agents. Builds on the existing AI Chat Agent.

**Effort:** Medium | **Impact:** Medium

---

#### 20. Management SDK / Client Libraries
Supabase offers official SDKs for JavaScript, Flutter, Python, C#, Swift, and Kotlin.

**Proposal:**
- Multibase Management SDK (TypeScript + Python)
- Programmatic access to the Management API
- Instance lifecycle, backup automation, metrics queries

**Effort:** Medium | **Impact:** Low

---

## Effort / Impact Matrix

| # | Feature | Impact | Effort | Version |
|---|---------|--------|--------|---------|
| 1 | GraphQL API Playground (pg_graphql) | ✅ Done | — | ~~v1.5~~ |
| 2 | Database Webhooks (pg_net) | ✅ Done | — | ~~v1.5~~ |
| 3 | Cron Job Manager (pg_cron) | ✅ Done | — | ~~v1.5~~ |
| 4 | Message Queues (pgmq) | ✅ Done | — | ~~v1.5~~ |
| 5 | RLS Policy Editor | ✅ Done | — | ~~v1.5~~ |
| 6 | AI & Vectors (pgvector) | ✅ Done | — | ~~v1.5~~ |
| 7 | Auth: Phone/SSO/CAPTCHA | ✅ Done | — | ~~v1.6~~ |
| 7a | Auth: Social Login | ✅ Done | — | ~~v1.6~~ |
| 8 | Custom Domains | ✅ Done | — | ~~v1.6~~ |
| 9 | Environment Labels + Clone Shortcuts | ✅ Done | 🟢 Low | **v1.6** |
| 10 | Read Replicas | ✅ Done | — | ~~v1.7~~ |
| 11 | Vault (Secrets) | ✅ Done | — | ~~v1.6~~ |
| 12 | SQL Editor (Base) | ✅ Done | — | ~~v1.5~~ |
| 12a | SQL Editor (Monaco/History) | 🟠 Low | 🟢 Low | **v1.6** |
| 13 | Edge Functions IDE | ✅ Done | — | ~~v1.7~~ |
| 14 | Log Drains | ✅ Done | — | ~~v1.7~~ |
| 15 | Realtime Dashboard | ✅ Done | — | ~~v1.7~~ |
| 16 | Storage CDN/Resumable | ✅ Done | 🟡 Medium | **v1.6** |
| 17 | Network Restrictions | ✅ Done | — | ~~v1.6~~ |
| 18 | Terraform/IaC | 🟡 Medium | 🔴 High | **v2.0** |
| 19 | MCP Server | ✅ Done | — | ~~v1.7~~ |
| 20 | Management SDK | 🟠 Low | 🟡 Medium | **v2.0** |
| 21 | Extension Marketplace | ✅ Done | — | ~~v1.8~~ |
| 22 | Feedback System | ✅ Done | — | ~~v1.8~~ |
| HC-1 | Multi-Region Control Plane | 🔴 Very High | 🔴 Very High | **v3.0** |
| HC-2 | GitOps + Terraform Provider | 🔴 High | 🔴 Very High | **v2.0** |
| HC-3 | AI Database Intelligence & Auto-Advisor | 🔴 Very High | 🔴 High | **v2.0** |
| HC-4 | Reseller & White-Label Platform | 🔴 High | 🔴 High | **v3.0** |
| HC-5 | Database Branching & Preview Environments | 🔴 Very High | 🔴 High | **v2.0** |
| MC-1 | Management SDK + CLI | 🟠 High | 🟡 Medium | **v2.0** |
| MC-2 | Advanced SQL Editor (Monaco, Multi-Tab, CSV Export) | 🟠 High | 🟡 Medium | **v2.0** |
| MC-3 | PITR + WAL Archiving | 🟠 High | 🔴 High | **v2.0** |
| MC-4 | Notification Hub (Slack, Discord, Telegram, PagerDuty) | 🟠 High | 🟡 Medium | **v2.0** |
| MC-5 | Schema Migration Manager | 🟠 High | 🟡 Medium | **v2.0** |
| MC-6 | Public Status Page Generator | 🟡 Medium–High | 🟡 Medium | **v2.0** |
| MC-7 | OpenTelemetry / APM Integration | 🟡 Medium–High | 🟡 Medium | **v3.0** |
| MC-8 | S3-Compatible API + Image Transformation | 🟡 Medium | 🟡 Medium | **v2.0** |
| MC-9 | Interactive Realtime Debugger & WebSocket Client | 🟡 Medium | 🟡 Medium | **v3.0** |
| MC-10 | Cost & Resource Analytics Dashboard | 🟡 Medium–High | 🟡 Medium | **v2.0** |
| LC-1 | CMD+K Command Palette | 🟠 High (UX) | 🟢 Low–Medium | **v2.0** |
| LC-2 | Dark / Light / System Theme Toggle | 🟡 Medium | 🟢 Low | **v2.0** |
| LC-3 | Instance Templates Gallery | 🟡 Medium–High | 🟢 Low–Medium | **v2.0** |
| LC-4 | Audit Log Export & Compliance Reports | 🟡 Medium–High | 🟢 Low | **v2.0** |
| LC-5 | API Key Improvements (Expiry, Rotation, Scopes) | 🟡 Medium | 🟢 Low–Medium | **v2.0** |
| LC-6 | One-Click Docker Compose Export | 🟡 Medium | 🟢 Low | **v2.0** |

---

## Release Plan

### v1.5 — Quick Wins + Differentiation ✅ Completed
> Focus: Unlocking Postgres extensions + Developer Experience

- [x] ~~SQL Editor in the Dashboard~~ ✅ Quick SQL Editor available in `SupabaseManager.tsx`
- [x] ~~RLS Policy Editor~~ ✅ Fully implemented (`PoliciesTab` + `CreatePolicyModal`)
- [x] ~~Social Auth Config~~ ✅ Google, GitHub, Discord etc. configurable in `AuthTab.tsx`
- [x] GraphQL API Playground + per-tenant routing (`ApiTab.tsx` — status, endpoint, copy button)
- [x] Database Webhooks UI (`WebhooksTab`, `CreateWebhookModal`, `WebhookService`, `pg_net`)
- [x] Cron Job Manager (`CronJobsTab`, `CreateCronJobModal`, `CronService`, `pg_cron`)
- [x] AI & Vectors (`VectorsTab`, `CreateVectorColumnModal`, `VectorService`, `pgvector`)
- [x] Message Queues (`QueuesTab`, `CreateQueueModal`, `QueueService`, `pgmq`)
- [x] Workspace Redesign — 3-level navigation:
  - `/workspace` → Org card grid (`WorkspaceOrgsPage`)
  - `/workspace/projects` → Project card grid with OrgSwitcher (`WorkspaceProjectsPage`)
  - `/workspace/projects/:project/:tab` → Fixed sidebar with all manager tabs (`WorkspaceProjectPage`)

### v1.6 — Enterprise & Agencies ✅ Completed
> Focus: White-labeling, security, auth extensions
> Detail plan: [V1.6_IMPLEMENTATION_PLAN.md](V1.6_IMPLEMENTATION_PLAN.md)

- [x] Auth tab integrated into Workspace Sidebar + removed from InstanceDetail
- [x] Auth extensions: Phone Login (Twilio/MessageBird/Vonage config), CAPTCHA (hCaptcha/Turnstile), Magic Link HTML template bodies, SAML SSO
- [x] Custom Domains per tenant (DNS CNAME check + Certbot SSL + Nginx config)
- [x] Environment Labels (production/staging/dev/preview) + "Clone as Staging/Dev" shortcuts
- [x] Storage: Tus Resumable Uploads (>6 MB) + Nginx CDN cache headers for public buckets
- [x] Vault Secrets UI — CRUD on `vault.secrets` (pgsodium) + documentation page
- [x] Network Restrictions: IP whitelist, SSL-only enforcement, rate limiting per instance

### v1.7 — Scale & Ecosystem ✅ Completed
> Focus: Scaling, observability, ecosystem
> Detail plan: [V1.7_IMPLEMENTATION_PLAN.md](V1.7_IMPLEMENTATION_PLAN.md)

- [x] Edge Functions IDE (CodeMirror + TypeScript + Env Vars + Test Runner) ✅
- [x] Read Replicas (PostgreSQL Streaming Replication UI) ✅
- [x] Log Drains (Webhook-based log export) ✅
- [x] Realtime Dashboard (Channels, Presence, Concurrent Users Config) ✅
- [x] MCP Server (Model Context Protocol — AI assistant integration) ✅

### v1.8 — Marketplace & Feedback ✅ Completed
> Focus: Extension ecosystem, community feedback

- [x] Extension Marketplace (51 extensions, categories, search, 1-click install, detail pages) ✅
- [x] Feedback System (public feedback API, admin dashboard, voting, status tracking) ✅

### v2.0 — Platform Maturity
> Focus: IaC, developer tools, observability, UX

- [ ] GitOps + Terraform Provider (HC-2)
- [ ] AI Database Intelligence & Auto-Advisor (HC-3)
- [ ] Database Branching & GitHub-native Preview Environments (HC-5)
- [ ] Management SDK + CLI (TypeScript & Python) (MC-1)
- [ ] Advanced SQL Editor (Monaco, Multi-Tab, Saved Queries, CSV Export) (MC-2)
- [ ] Point-in-Time Recovery (PITR) with WAL Archiving (MC-3)
- [ ] Notification Hub (Slack, Discord, Telegram, PagerDuty, MS Teams) (MC-4)
- [ ] Schema Migration Manager (MC-5)
- [ ] Public Status Page Generator (MC-6)
- [ ] S3-Compatible API Endpoint + Advanced Image Transformation (MC-8)
- [ ] Cost & Resource Analytics Dashboard (MC-10)
- [ ] CMD+K Command Palette (LC-1)
- [ ] Dark / Light / System Theme Toggle (LC-2)
- [ ] Instance Templates Gallery (LC-3)
- [ ] Audit Log Export & Compliance Reports (LC-4)
- [ ] API Key Improvements (Expiry, Rotation, Scopes, Usage Stats) (LC-5)
- [ ] One-Click Docker Compose Export (LC-6)

### v3.0 — Enterprise Scale
> Focus: Multi-region, reseller, advanced observability

- [ ] Multi-Region Control Plane (HC-1)
- [ ] Reseller & White-Label Platform (HC-4)
- [ ] OpenTelemetry / APM Integration (MC-7)
- [ ] Interactive Realtime Debugger & WebSocket Client (MC-9)

---

## v2.0+ Feature Details

> Detailed descriptions of all planned features by priority class.
> As of: April 2026

---

### HIGH CLASS — Strategic Differentiation

#### HC-1: Multi-Region Control Plane

**Description:** Multibase becomes a distributed platform. A central dashboard instance (Control Plane) manages multiple physical servers/VPS across different regions. Each remote agent runs as a lightweight Node process and communicates with the Control Plane via a WebSocket tunnel.

**Why valuable:**
- Today Multibase is single-server. For enterprise customers with GDPR requirements (data in the EU) or latency requirements, this is a blocker.
- Makes Multibase competitive with Supabase Multi-Region.
- Enables active-passive failover.

**Technical Components:**
- Control Plane API: `POST /api/nodes` — register a node (URL + API key of the remote agent)
- Remote Agent: minimal Express server on the remote host that executes Docker commands locally and reports metrics back
- Dashboard: node overview with region, status, tenant count, CPU/RAM (world map)
- Instance creation: select a node or "auto-assign" based on available RAM
- WebSocket tunnel with heartbeat + reconnect logic
- Failover: automatic DNS switch on node failure

**Effort:** Very high | **Impact:** Very high | **Version:** v3.0

---

#### HC-2: GitOps + Terraform Provider (Infrastructure as Code)

**Description:** Declarative infrastructure management for Multibase. Two deliverables: (a) a Terraform Provider (`terraform-provider-multibase`), (b) a GitOps workflow where a Git repo serves as the source of truth for instances and extensions.

**Why valuable:**
- DevOps teams don't want click-ops. Infrastructure should be versioned, reviewable, and reproducible.
- Terraform Provider: `terraform apply` creates/configures instances, organizations, backups, extensions.
- GitOps: push to main → webhook → Multibase automatically synchronizes instances.

**Technical Components:**
- Terraform Provider in Go (Terraform Plugin SDK v2), published on registry.terraform.io
- Resources: `multibase_instance`, `multibase_organization`, `multibase_member`, `multibase_extension`, `multibase_backup_schedule`, `multibase_domain`, `multibase_api_key`
- GitOps manifest (`multibase.yaml`): declares desired state → reconciliation loop every 60s
- Webhook endpoint `POST /api/gitops/sync` for CI/CD triggers
- Drift detection: `terraform plan` shows what has changed compared to the current state

**Effort:** Very high | **Impact:** High (enterprise segment) | **Version:** v2.0

---

#### HC-3: AI-Powered Database Intelligence & Auto-Advisor

**Description:** An intelligent database advisor that continuously analyzes query patterns and proactively suggests optimizations. Integrated into the existing AI Chat Agent, but with dedicated dashboard views.

**Components:**
1. **Index Advisor**: Analyzes `pg_stat_statements`, detects sequential scans → suggests missing indexes (with estimated performance gain in %)
2. **Schema Advisor**: Detects `TEXT` columns that would be better as `UUID`, `JSONB` without indexes, un-normalized structures
3. **Query Explainer**: Click on a query → AI explains the execution plan in plain language
4. **Anomaly Detection**: Detects sudden query slowdowns, lock waits, connection spikes — pushes an alert before the user notices
5. **Natural Language to SQL**: In the SQL Editor: "Show me all users who registered last week" → SQL is generated

**Technical:**
- `DatabaseAdvisorService.ts` — polls `pg_stat_statements`, `pg_stat_user_tables`, `pg_stat_user_indexes` every 5 minutes
- Prompts against AI API with context from DB stats (uses existing AI Chat Agent)
- New `advisor` tab in the Workspace Sidebar
- Integration into existing Alert Service

**Placement:** `/workspace/projects/:project/advisor`

**Effort:** High | **Impact:** Very high | **Version:** v2.0

---

#### HC-4: Reseller & White-Label Platform

**Description:** Multibase becomes a platform-for-platforms. Agencies and MSPs can offer Multibase as their own product — with their own logo, domain, pricing, and customer portal.

**Components:**
1. **White-Label Branding**: Logo, primary color, app name, favicon, custom domain for the dashboard itself — configurable per organization
2. **Client Portal**: Reduced dashboard for end customers — they only see their own instance, no infrastructure details
3. **Reseller Dashboard**: Overview of all customer instances, resource usage, billing data
4. **Usage Metering**: Track CPU hours, storage GB, API calls per tenant
5. **Stripe Billing Integration**: Automatic invoicing per tenant based on usage

**Effort:** High | **Impact:** High (new market segment) | **Version:** v3.0

---

#### HC-5: Database Branching & Preview Environments (GitHub-native)

**Description:** True database branching that is automatically triggered by GitHub/GitLab PRs. For each PR, a temporary database instance is created, migrations are applied, and a preview link is generated. After merge/close, the branch instance is automatically deleted.

**Why valuable:**
- Supabase offers this for cloud customers. For self-hosted, there is no comparable solution.
- Developers can safely test schema changes without touching the staging DB.
- Builds on the existing cloning feature — the foundation is already there.

**Components:**
1. **GitHub App / Webhook Receiver**: `POST /api/webhooks/github` receives PR events
2. **Branch Manager**: Creates a cloned instance with label `preview`, name `<project>-pr-<number>`, TTL 7 days
3. **Migration Runner**: Automatically runs SQL migration files from the PR on the branch DB
4. **PR Comment Bot**: Automatically posts a comment with branch DB URL, API keys, connection string
5. **Auto-Cleanup**: TTL-based garbage collector — deletes branches after merge or 7 days

**Placement:** New `branches` tab in the Workspace Sidebar

**Effort:** High | **Impact:** Very high | **Version:** v2.0

---

### MID CLASS — Solid Improvements

#### MC-1: Management SDK + CLI (TypeScript & Python)

**Description:** Official `@multibase/sdk` npm package and `multibase` Python package for programmatic access to the Management API. Plus a `multibase-cli` for terminal usage.

**TypeScript usage:**
```typescript
import { MultibaseClient } from '@multibase/sdk';

const client = new MultibaseClient({ baseUrl: 'https://your-host', apiKey: '...' });
const instances = await client.instances.list();
await client.instances.create({ name: 'my-app', environment: 'staging' });
await client.backups.create('my-app');
const result = await client.sql('my-app', 'SELECT count(*) FROM users');
```

**CLI usage:**
```bash
multibase instances list
multibase instances create my-app --env staging
multibase backup create my-app
multibase sql my-app "SELECT count(*) FROM users"
multibase extensions install my-app stripe-webhooks
```

**Effort:** Medium | **Impact:** High | **Version:** v2.0

---

#### MC-2: Advanced SQL Editor (Monaco, Multi-Tab, Saved Queries, CSV Export)

**Description:** Complete upgrade of the Quick SQL Editor:
- Monaco Editor with SQL syntax highlighting, auto-complete (tables/columns from schema), formatting
- Multi-tab interface — multiple queries open simultaneously (like browser tabs)
- Saved queries per organization with names, tags, descriptions, and sharing
- Execution time + row count display after each query
- Export as CSV, JSON, Excel
- Query history (last 50 executions with timestamp + duration)
- Read-only vs. write-mode toggle (configurable security level)

**Placement:** Upgrade of the `SupabaseManager.tsx` SQL tab + dedicated route `/workspace/projects/:project/sql`

**Effort:** Medium | **Impact:** High | **Version:** v2.0

---

#### MC-3: Point-in-Time Recovery (PITR) with WAL Archiving

**Description:** True PITR functionality through continuous WAL (Write-Ahead Log) archiving. Currently only pg_dump snapshots exist. PITR enables recovery to any arbitrary second within a time window.

**Components:**
- WAL Archiving: Configures `archive_command` in the instance's PostgreSQL → WAL segments are automatically stored in `backups/<instance>/wal/`
- Recovery UI: Calendar + time selection → "Restore the DB to how it was on 2026-04-01 at 14:32:07"
- Recovery process: spin up new instance → apply base backup → replay WAL to target timestamp
- Backup Verification: Automatic daily restore test on a temporary test instance
- Retention Policy: Configurable (1 day to 30 days WAL archive)

**Effort:** High | **Impact:** High | **Version:** v2.0

---

#### MC-4: Notification Hub (Slack, Discord, Telegram, PagerDuty, MS Teams)

**Description:** Central notification center that forwards existing alerts (CPU, RAM, instance down, backup failed) to various channels.

**Supported channels:**
- Slack (webhook or app) with formatted Block Kit message
- Discord Webhook
- Telegram Bot (bot token + chat ID)
- PagerDuty (for on-call duty)
- MS Teams Webhook
- Email (supplements the existing SMTP system with HTML templates)

**UI:** Settings page `/settings/notifications` with:
- Channel management (CRUD)
- Test button per channel
- Per-channel alert filter (which alert types go where)
- Severity level mapping (Critical → PagerDuty, Warning → Slack)

**Effort:** Medium | **Impact:** High | **Version:** v2.0

---

#### MC-5: Schema Migration Manager

**Description:** Structured migration system similar to Prisma Migrate or Flyway, directly in the dashboard:
- Create/edit migration files (numbered: `001_create_users.sql`, `002_add_avatar.sql`)
- Migration history with status (applied/pending/failed) + timestamp
- Schema diff viewer between two instances (dev vs. staging vs. prod)
- One-click apply to any instance
- Rollback support (when `rollback.sql` is provided)
- "Squash Migrations" — combine multiple migrations into one

**Placement:** New `migrations` tab in the Workspace Sidebar (after `database`)

**Effort:** Medium | **Impact:** High | **Version:** v2.0

---

#### MC-6: Public Status Page Generator

**Description:** A publicly accessible status page per organization (e.g. `status.myapp.com`):
- Configurable which instances/services are visible (with custom names)
- Availability history (last 90 days as bar chart like statuspage.io)
- Incident management: create, update, close incidents manually → automatically reflected on the status page
- RSS/Atom feed for subscribers
- Email subscription for users
- Custom domain + own logo + custom CSS

**Placement:** `/status/:org-slug` (public) + `/settings/status-page` (config)

**Effort:** Medium | **Impact:** Medium–High | **Version:** v2.0

---

#### MC-7: OpenTelemetry / APM Integration

**Description:** Distributed tracing and application performance monitoring through OpenTelemetry integration:
- Configure Vector (already available as a container) as an OTel Collector
- Export traces from Edge Functions, auth calls, REST API requests
- Supported backends: Jaeger (self-hosted), Grafana Tempo, Datadog, Honeycomb, New Relic
- Dashboard: top 10 slowest API calls, error rate per endpoint, P50/P95/P99 latency
- Span visualization (flamegraph / waterfall view) per request

**Placement:** New `apm` tab in the Workspace Sidebar + settings for OTel backend

**Effort:** Medium | **Impact:** Medium–High | **Version:** v3.0

---

#### MC-8: S3-Compatible API Endpoint + Advanced Image Transformation

**Description:** Extension of the Storage Manager:
1. **S3-Compatible API**: Each instance gets an S3-compatible endpoint — allows existing S3-SDK-compatible tools (rclone, aws-cli, Cyberduck) to be used
2. **Image Transformation Pipeline**: Extension of the imgproxy container with URL-based transformation via query params (`?width=200&height=200&format=webp&quality=80`)
3. **Bucket Lifecycle Policies**: Auto-delete after N days, transition to "cold storage"
4. **Storage Versioning**: File versioning per bucket (keeps up to N old versions)

**Effort:** Medium | **Impact:** Medium | **Version:** v2.0

---

#### MC-9: Interactive Realtime Debugger & WebSocket Client

**Description:** A fully-featured WebSocket testing tool directly in the dashboard (no Postman or Insomnia needed):
- Subscribe to channels with any filter (table, event type, filter expression)
- Manually send and receive broadcast messages
- Simulate presence (multiple virtual clients simultaneously)
- Message timeline with timestamps, event type, and payload viewer (formatted JSON)
- Performance test: simulate N concurrent connections → measure throughput, latency
- Code snippet generator: JavaScript, Python, Dart

**Placement:** Extension of the `realtime` tab in the Workspace Sidebar

**Effort:** Medium | **Impact:** Medium | **Version:** v3.0

---

#### MC-10: Cost & Resource Analytics Dashboard

**Description:** Historical resource and cost dashboard:
- Hourly CPU/RAM/storage/bandwidth metrics per instance (historical, not just real-time)
- Cost estimation based on configurable prices (€ per GB RAM/hour, € per GB storage/month)
- Budget alerts: "Instance X has used 30% more RAM this week than last week"
- Comparison between instances: ranking by resource consumption
- Export as CSV for accounting / chargeback reports
- Forecast: "At current growth, instance X will need twice as much RAM in 14 days"

**Placement:** New page `/analytics` in the global navigation

**Effort:** Medium | **Impact:** Medium–High | **Version:** v2.0

---

### LOW CLASS — Quick Wins & UX Improvements

#### LC-1: CMD+K Command Palette

**Description:** Global command palette (like VS Code, Linear, Vercel) that opens with `Ctrl+K` / `Cmd+K`:
- Fuzzy search across all instances, organizations, pages, actions
- Quick actions: "Create Instance", "Start `<name>`", "Open SQL Editor for `<name>`", "Trigger Backup"
- Keyboard navigation (arrow keys + enter)
- Recently used items at the top of the list
- Implementation via the `cmdk` library (available in the Shadcn ecosystem)

**Effort:** Low–Medium | **Impact:** High (UX) | **Version:** v2.0

---

#### LC-2: Dark / Light / System Theme Toggle

**Description:** User preference for dashboard theme:
- **System**: follows OS setting via `prefers-color-scheme` media query
- **Light**: bright theme with Shadcn/ui light palette
- **Dark**: existing dark theme

**Implementation:** `useTheme` hook + Tailwind `dark:` classes. Toggle in user profile or header. Preference is stored in the user profile in the DB.

**Effort:** Low | **Impact:** Medium | **Version:** v2.0

---

#### LC-3: Instance Templates Gallery

**Description:** Curated template gallery with pre-configured instance blueprints:
- **"SaaS Starter"** — pgcrypto, RLS enabled, standard auth config, SMTP pre-filled
- **"AI App"** — pgvector enabled, pgmq for background jobs, OpenAI key config
- **"E-Commerce"** — Stripe webhook extension pre-installed, product schema
- **"Blog & CMS"** — blog extension, auth, storage for media
- Template creation from an existing instance ("Save as Template")
- Template sharing between organizations

**Placement:** Extension of the existing Templates page + selection during instance creation

**Effort:** Low–Medium | **Impact:** Medium–High | **Version:** v2.0

---

#### LC-4: Audit Log Export & Compliance Reports

**Description:** Extension of the existing audit log system:
- Export as CSV, JSON, ndjson with configurable time range and filter criteria
- Filter: by action type, user, instance, IP address, severity
- GDPR report: "Who accessed which instance and when?" as a structured PDF
- SOC2-compatible report export with signature timestamp
- Retention policy configurable (30 days to 2 years, auto-delete)
- Webhook-based audit log forwarding to SIEM systems (Splunk, Elastic)

**Placement:** Extension of the existing `ActivityLog.tsx`

**Effort:** Low | **Impact:** Medium–High | **Version:** v2.0

---

#### LC-5: API Key Improvements (Expiry, Rotation, Scopes, Usage Stats)

**Description:** Extension of the API key system:
- **Expiration date** per key (e.g. after 30/60/90 days) with reminder email
- **Rotation workflow**: generate new key, old key remains valid for 24h (grace period)
- **IP restriction** per key (only usable from specific CIDR blocks)
- **Usage statistics**: number of API calls per key in the last 24h/7d/30d
- **Scoped keys**: keys with restricted permissions (e.g. "read only", "backup endpoint only")
- **Labels & descriptions**: "CI/CD Pipeline Key", "Monitoring Key", "Terraform Key"

**Effort:** Low–Medium | **Impact:** Medium | **Version:** v2.0

---

#### LC-6: One-Click Docker Compose Export

**Description:** "Export as Docker Compose" button per instance:
- Generates a portable `docker-compose.yml` with all services, volumes, port mappings
- `.env` file is exported separately (secrets are not embedded in the compose file)
- Options: "Config only" (without data) or "incl. backup reference"
- Useful for migrating an instance to another server without Multibase

**Effort:** Low | **Impact:** Medium | **Version:** v2.0

---

*Created: March 2026 | Last updated: April 9, 2026*

