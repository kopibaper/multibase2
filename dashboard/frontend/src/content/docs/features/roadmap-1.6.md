---
title: Version 1.6 - Security & Configuration
description: Auth workspace tab, Custom Domains, Vault Secrets UI, Network Restrictions, Environment Labels, Storage Tus Uploads
---

# Version 1.6 — Security & Configuration

**Status:** ✅ Released  
**Release:** March 2026  
**Use Case:** Production-ready self-hosting with custom domains, enhanced auth, secrets management, and security hardening

---

## 🎯 Overview

v1.6 focuses on **security, configuration management, and operational readiness** for production deployments. Auth moves into the unified Workspace, and 4 new dedicated configuration tabs are introduced.

| # | Feature | Location | Priority |
|---|---------|----------|----------|
| 1 | Auth Tab in Workspace | `WorkspaceProjectPage` sidebar | High |
| 2 | Auth Extensions (Twilio, CAPTCHA, SAML SSO) | `AuthTab.tsx` extension | High |
| 3 | Custom Domains (DNS-Check + Certbot) | New tab `domains` | High |
| 4 | Environment Labels & Clone Shortcuts | `WorkspaceProjectsPage` + DB | Medium |
| 5 | Storage: Tus Resumable Uploads + CDN Cache | `StorageTab.tsx` extension | Medium |
| 6 | Vault Secrets UI | New tab `vault` | Medium |
| 7 | Network Restrictions (IP Whitelist + Rate Limit) | New tab `security` | Medium |

---

## 🏗️ Workspace Sidebar (v1.6)

```
/workspace/projects/:project/:tab
  Main tabs: overview | auth | database | storage | policies |
             functions | webhooks | cron | vectors | queues | api | smtp | keys
  ─── Configuration ───
  auth | vault | domains | security
```

The `AuthTab` is **removed** from `InstanceDetail` and now lives exclusively in the Workspace under `/workspace/projects/:name/auth`.

---

## 🔐 Auth Tab in Workspace ✅

**Priority:** High  
**Effort:** Small

### Description

Moves the fully-implemented `AuthTab.tsx` from `InstanceDetail` into the Workspace sidebar. All OAuth provider config, email/phone toggles, and SMTP settings are accessible from one central location.

- Auth tab added to `WorkspaceProjectPage` sidebar with Shield icon
- Auth tab removed from `InstanceDetail.tsx`
- No new backend endpoints — uses existing `GET/PATCH /api/instances/:name/env`

---

## 🔑 Auth Extensions ✅

**Priority:** High  
**Effort:** Medium

### Phone Login (Twilio / MessageBird / Vonage)

Extends the existing Phone Signup toggle with SMS provider configuration. A dropdown selects the provider, and the corresponding credential fields appear dynamically.

**Supported providers:** Twilio, MessageBird, Vonage  
**ENV vars:** `GOTRUE_SMS_PROVIDER`, `GOTRUE_SMS_TWILIO_*`, `GOTRUE_SMS_MESSAGEBIRD_*`, `GOTRUE_SMS_VONAGE_*`

### Magic Link HTML Templates

Adds textarea fields for the full HTML body of transactional emails, alongside the existing subject-line inputs.

**Templates:** Confirmation, Recovery, Invite, Magic Link, Email Change  
**ENV vars:** `GOTRUE_MAILER_TEMPLATES_*`

### CAPTCHA Integration

New section in the Security area to enable hCaptcha or Cloudflare Turnstile.

**ENV vars:** `GOTRUE_SECURITY_CAPTCHA_ENABLED`, `GOTRUE_SECURITY_CAPTCHA_PROVIDER`, `GOTRUE_SECURITY_CAPTCHA_SECRET`

### SAML SSO

New section for enterprise SAML 2.0 identity provider configuration.

**ENV vars:** `GOTRUE_SAML_ENABLED`, `GOTRUE_SAML_METADATA_URL`, `GOTRUE_SAML_PRIVATE_KEY`

> All auth extensions use the existing `PATCH /api/instances/:name/env` endpoint — no new backend routes needed.

---

## 🌐 Custom Domains ✅

**Priority:** High  
**Effort:** Medium

### Description

Allows mapping a custom domain (e.g. `api.meine-firma.de`) to a Multibase instance. The workflow guides the user through DNS verification and automatic SSL certificate issuance.

### Workflow

1. User enters custom domain (e.g. `api.meine-firma.de`)
2. Dashboard displays the required CNAME record
3. User sets CNAME at their DNS provider
4. Backend performs DNS lookup to verify the record
5. Certbot issues an SSL certificate for the custom domain
6. Nginx config is updated with the new `server_name` and reloaded

### Statuses

| Status | Meaning |
|--------|---------|
| `pending_dns` | Waiting for DNS propagation |
| `dns_verified` | CNAME confirmed, ready for SSL |
| `ssl_pending` | Certbot in progress |
| `active` | Fully operational |
| `error` | Check error details |

### New Prisma Model

```prisma
model CustomDomain {
  id           String    @id @default(cuid())
  instanceName String
  domain       String
  status       String    @default("pending_dns")
  sslIssuedAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@unique([instanceName, domain])
}
```

---

## 🏷️ Environment Labels & Clone Shortcuts ✅

**Priority:** Medium  
**Effort:** Small

### Description

Each instance can be tagged with an environment label. Labels are color-coded and appear as badges on project cards. Clone shortcuts allow spinning up a staging or dev copy in one click.

### Labels

| Label | Color | Behavior |
|-------|-------|---------|
| `production` | Red/Orange | Warns on destructive actions |
| `staging` | Yellow | — |
| `dev` | Blue | — |
| `preview` | Purple | — |

### Clone Shortcuts

From the project card menu:
- **Set as Production / Staging / Dev**
- **Clone as Staging** → clones instance, sets label `staging`, names it `<name>-staging`
- **Clone as Dev** → clones instance, sets label `dev`, names it `<name>-dev`

**New field:** `environment String?` on the `Instance` Prisma model.

---

## 📦 Storage: Tus Resumable Uploads + CDN Cache ✅

**Priority:** Medium  
**Effort:** Medium

### Tus Resumable Uploads

Supabase Storage natively supports Tus at `/storage/v1/upload/resumable`. v1.6 integrates `@uppy/tus` for automatic large-file handling.

- Files **≥ 6 MB** → Tus upload with progress bar and automatic resume on reconnect
- Files **< 6 MB** → existing standard POST upload (no overhead)
- Progress display: percentage, cancel button

### Nginx CDN Cache

Adds `Cache-Control` headers to the Nginx gateway for public storage buckets:

```nginx
location /storage/v1/object/public/ {
    proxy_cache_valid 200 24h;
    add_header Cache-Control "public, max-age=86400, stale-while-revalidate=3600";
}
```

- Toggle: Enable/Disable CDN cache per instance
- Configurable TTL (hours)
- Cache invalidation via Nginx reload

---

## 🔒 Vault Secrets UI ✅

**Priority:** Medium  
**Effort:** Small

### Description

`pgsodium` / `pg_vault` is included with every Supabase PostgreSQL instance. v1.6 adds a UI for managing secrets stored in `vault.secrets` via SQL execution.

### Key Features

- **Secrets List**: Shows name, description, updated_at — **values never displayed in the list**
- **Add Secret**: Name, description, value (password input)
- **Reveal**: One-time display of a decrypted secret value
- **Edit**: Update a secret's value
- **Delete**: With confirmation dialog

> Values are stored encrypted via AES-256-GCM (pgsodium). They are never logged.

### API Routes

```
GET    /api/instances/:name/vault
POST   /api/instances/:name/vault
GET    /api/instances/:name/vault/:id/reveal
PATCH  /api/instances/:name/vault/:id
DELETE /api/instances/:name/vault/:id
```

---

## 🛡️ Network Restrictions ✅

**Priority:** Medium  
**Effort:** Small

### Description

Adds a `security` tab combining SSL enforcement, IP whitelisting, and API rate limiting — all backed by Nginx gateway configuration.

### SSL Enforcement

Redirects all HTTP requests to HTTPS when `SECURITY_SSL_ONLY=true`. Requires a valid SSL certificate to be configured.

### IP Whitelist

When enabled, only listed IPs/CIDR ranges are allowed to access the API. A warning banner appears if the whitelist is enabled to prevent accidental lockout.

**ENV var:** `SECURITY_IP_WHITELIST` (comma-separated IPs/CIDRs)

### Rate Limiting

Per-IP request limiting via Nginx `limit_req_zone`.

**ENV var:** `SECURITY_RATE_LIMIT_RPM` (10–1000, default 300 req/min)

> IP whitelist and rate limit rules are generated into the Nginx gateway config and applied via `nginx -s reload` (~50ms, zero downtime).
