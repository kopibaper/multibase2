# Extension Marketplace

**Status:** ✅ Available
**Location:** `/marketplace` in the dashboard
**Extensions:** 51 official extensions across 6 categories

---

## Overview

The Extension Marketplace lets you install pre-built SQL schemas, Edge Functions, and configuration templates onto any of your managed Supabase instances — directly from the Multibase dashboard without writing a single line of code.

---

## How to Install an Extension

1. **Open the Marketplace** — Click **Marketplace** in the top navigation
2. **Browse or search** — Filter by category or use the search bar
3. **Click Details / Install** on any extension card
4. **Select your instance** — Choose which Supabase instance to install onto
5. **Configure** — Fill in required values (API keys, schema names, etc.)
6. **Install** — Watch the live progress log as each step runs
7. **Done** — The extension is active and visible in the Extensions tab of your instance

---

## Extension Categories

### 🗄️ Database
Pre-built PostgreSQL schemas with tables, RLS policies, indexes, and optional seed data.

| Extension | What it installs |
|-----------|-----------------|
| E-Commerce Starter | Products, orders, customers, inventory, categories |
| Blog & CMS | Posts, tags, categories, comments, full-text search |
| SaaS Starter | Organizations, memberships, subscriptions, feature flags |
| Multi-Tenant Base | Row-level tenant isolation with automatic RLS |
| Audit Trail | Trigger-based change history for any table |
| Booking System | Resources, time slots, reservations, availability rules |
| Chat & Messaging | Rooms, messages, reactions, read receipts |
| Survey Builder | Surveys, questions, conditional logic, responses |
| Workflow Engine | State machines, transitions, instance history |
| GDPR Toolkit | Consent records, data requests, deletion schedules |
| + more |  |

### 🔐 Auth
OAuth providers, advanced authentication flows, and access control.

| Extension | What it does |
|-----------|-------------|
| Social Login Bundle | Enables Google, GitHub, Discord OAuth in one step |
| Enterprise SSO | SAML configuration for Azure AD, Okta, Google Workspace |
| Passkey / WebAuthn | Passwordless biometric login (Face ID, Touch ID, YubiKey) |
| Phone Authentication | SMS OTP via Twilio |
| 2FA Enforcement | TOTP requirement for all users |
| IP Allowlist | Restrict access to specific IP ranges |
| Session Manager | Multi-device session management with revocation |

### ⚡ Functions
Edge Functions deployed directly to your instance.

| Extension | What it does |
|-----------|-------------|
| Stripe Webhooks | Handles payment events, stores in `payments` table |
| Resend Transactional | Sends emails on database events |
| Slack Notifier | Sends Slack messages when rows change |
| PDF Generator | Converts HTML to PDF via an HTTP endpoint |
| OpenAI Proxy | Secure proxy with rate limiting and cost tracking |
| Webhook Dispatcher | Reliable delivery with retry and HMAC signing |
| URL Shortener | Short URLs with click analytics |

### 📊 Monitoring
Observability tools and alerting integrations.

| Extension | What it does |
|-----------|-------------|
| Grafana Dashboard | Imports a pre-built dashboard for Multibase metrics |
| Sentry Integration | Catches Edge Function errors and sends to Sentry |
| Slow Query Tracker | Logs slow queries from `pg_stat_statements` |
| Table Size Monitor | Tracks table growth and alerts on spikes |
| Uptime Kuma | Exports monitoring configuration for all services |

### 🤖 AI / Vectors
pgvector-powered search and LLM integrations.

| Extension | What it does |
|-----------|-------------|
| RAG Starter | Full pipeline: upload → chunk → embed → search |
| Semantic Search | Adds vector similarity search to any text column |
| Knowledge Base | Structured wiki with vector + full-text search |
| AI Chat History | Persistent conversation storage for LLM apps |
| AI Image Analysis | GPT-4o Vision: alt text, tags, NSFW filter on upload |
| Content Summarizer | Auto-summarizes any text column on insert/update |

### 💾 Storage
File handling and CDN integrations.

| Extension | What it does |
|-----------|-------------|
| S3 Mirror | Syncs storage buckets to AWS S3, Cloudflare R2, or Backblaze |
| CDN Cache Purge | Invalidates CDN cache on file changes |
| Storage Analytics | Tracks bucket usage and alerts near storage limits |

---

## Managing Installed Extensions

Open any instance workspace and click the **Extensions** tab in the sidebar.

From there you can:
- See all installed extensions with version and status
- View the configuration used during installation
- **Uninstall** — runs the rollback SQL and removes the record

---

## Extension Status Values

| Status | Meaning |
|--------|---------|
| `active` | Successfully installed and running |
| `updating` | Installation in progress |
| `error` | Installation failed — check the audit log |
| `disabled` | Manually disabled |

---

## Configuration & Variables

Each extension defines a configuration schema. During installation you fill in values like:

- Schema name (`public`, `shop`, etc.)
- API keys (Stripe secret, OpenAI key, etc.)
- Feature toggles (include demo data, enable NSFW filter, etc.)

These values are interpolated into SQL files at install time:

```sql
-- What's in schema.sql:
CREATE SCHEMA IF NOT EXISTS {{schemaName}};

-- What runs on your instance:
CREATE SCHEMA IF NOT EXISTS shop;
```

Values are stored encrypted in the `InstalledExtension` record and can be referenced when updating or reinstalling.

---

## Security

All extension installations are protected by multiple layers:

- **SQL validation** — dangerous statements (`DROP DATABASE`, `ALTER SYSTEM`, etc.) are blocked
- **Manifest allow-list** — manifest URLs must come from trusted hosts only
- **Rate limiting** — max 3 installs per instance per hour
- **Audit log** — every install and uninstall is logged with user, IP, and timestamp
- **RLS policies** — all database extensions enable Row Level Security by default

---

## Adding Custom Extensions

Extensions are loaded from `backend/extensions/{id}/`. To add your own:

1. Create a folder: `backend/extensions/my-extension/`
2. Add `manifest.json` describing the installation steps
3. Add `schema.sql` with your PostgreSQL schema
4. Optionally add `rollback.sql` for clean uninstall
5. Add the extension definition to `src/data/marketplace-extensions.ts`
6. Restart the backend — it appears in the Marketplace automatically

See [EXTENSION_MARKETPLACE.md](/setup/reference/marketplace-technical) for the full technical reference.
