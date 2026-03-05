---
title: Version 1.3 - Cloud Architecture & AI
description: Cloud Infrastructure, Kong→Nginx Migration, Workspace, AI Chat Agent
---

# Version 1.3 - Feature Roadmap

**Release:** February 2026  
**Status:** ✅ Released

> All core features shipped. Multi-Tenancy & Organisations continue in v1.4.

---

## ☁️ Shared Cloud Infrastructure ✅

**Priority:** High  
**Effort:** Completed

### Description

Centralized shared services architecture that eliminates per-tenant duplicates. Instead of 12+ containers per project, tenants now run only 5 containers while sharing 8 infrastructure services.

### Implemented Features

- **8 Shared Services**: PostgreSQL, Studio, Analytics, Vector, imgproxy, Pooler (Supavisor), Meta, Nginx Gateway
- **5 Per-Tenant Services**: Auth (GoTrue), REST (PostgREST), Realtime, Storage, Edge Functions
- **Resource Savings**: ~7 GiB RAM saved for 5 tenants vs. classic deploy
- **Automatic Bootstrapping**: `setup_shared.py start` provisions shared stack + generates nginx config
- **SharedInfra Dashboard**: Web UI showing all 8 services with start/stop/restart controls
- **Resource Monitoring**: Aggregated CPU & RAM GaugeCharts for the entire shared stack

> 📖 [Cloud Architecture Implementation Log](/setup/reference/cloud-architecture)

---

## 🔀 Kong → Nginx Gateway Migration ✅

**Priority:** High  
**Effort:** Completed

### Description

Replaced all per-tenant Kong API gateways with a single shared Nginx reverse proxy. The gateway handles routing for all tenants via dynamic upstream resolution.

### Implemented Features

- **Single Gateway**: One Nginx container replaces N Kong containers
- **Dynamic Routing**: `set $upstream` + `resolver 127.0.0.11` for deferred DNS
- **Auto-Config Generation**: `setup_shared.py` generates nginx conf per tenant on start/create
- **Health Checks**: Built-in upstream health monitoring
- **Backward Compatible**: Same API URLs, same port layout (`:8000` gateway)
- **RAM Savings**: ~1.4 GiB per tenant (Kong removed entirely)

> 📖 [Kong→Nginx Migration Reference](/setup/reference/kong-nginx-migration)

---

## 🖥️ Workspace Page ✅

**Priority:** High  
**Effort:** Completed

### Description

Unified project management interface combining all project-level operations in a single view with sidebar navigation.

### Implemented Features

- **Project Sidebar**: Searchable project list with status indicators
- **Studio Integration**: One-click Supabase Studio activation per project
- **API Keys Modal**: Quick-access to project JWT, anon/service keys
- **SMTP Settings**: Per-project email configuration panel
- **Manager Tab**: Instance lifecycle controls (start, stop, restart, delete)

---

## 🤖 AI Chat Agent ✅

**Priority:** High  
**Effort:** Completed

### Description

Integrated AI assistant for natural-language infrastructure management. Supports multi-provider LLMs with tool calling to operate all Supabase instances directly from the chat panel.

### Implemented Features

- **Multi-Provider Support**: OpenAI, Anthropic, Google Gemini, OpenRouter (incl. Llama, Mistral, DeepSeek)
- **30+ Tools**: Instance CRUD, backups, storage, SQL execution, logs, metrics, templates, alerts
- **Destructive Action Confirmation**: Dangerous operations require explicit user approval
- **Session Management**: Persistent chat history per user with multiple sessions
- **SSE Streaming**: Real-time response streaming via Server-Sent Events
- **Encrypted Key Storage**: User API keys encrypted at rest (AES-256-GCM)
- **Rate Limiting**: 50 messages/hour per user

---

## Planned Features

The following features are planned for future v1.3 releases.

---

## 🏢 Multi-Tenancy/Teams

**Priority:** Medium  
**Effort:** High (2-3 Weeks)

### Description

Support for multiple teams/organizations on a single installation with isolated instances.

### Planned Features

- **Organization/Team Management**
  - Create and manage teams
  - Invite and manage team members
  - Roles per Team (Owner, Admin, Member, Viewer)
- **Instance Isolation**
  - Instances assigned to a team
  - Team members only see their team's instances
  - Cross-team Admins (Platform Admins)
- **Resource Quotas**
  - Max instances per team
  - CPU/Memory limits per team
  - Storage quotas

---

## 💰 Cost Tracking & Billing

**Priority:** Low  
**Effort:** High (3-4 Weeks)

### Description

Track resource usage and generate billing reports.

### Planned Features

- **Resource Tracking**
  - CPU hours per instance
  - Memory usage over time
  - Storage consumption
  - Network traffic
- **Cost Calculation**
  - Configurable prices per resource
  - Monthly/weekly reports
  - Cost breakdown per instance/team
- **Budget Management**
  - Set budget limits
  - Alerts on budget threshold
  - Auto-stop on budget limit (optional)
- **Billing Export**
  - CSV/PDF export
  - Invoice generation
  - Stripe/Payment gateway integration

---

## 💾 S3 Storage Integration

**Priority:** Medium  
**Effort:** Medium (1 Week)

### Description

Store backups and large files in S3-compatible storage (AWS, MinIO, Backblaze B2).

### Planned Features

- **S3 Configuration**
  - AWS S3 support
  - MinIO support
  - Backblaze B2 support
- **Automatic Offload**
  - Backup offload to S3
  - Configurable policies
- **Storage Browser**
  - View stored files
  - Download/delete from dashboard

---

## 🔒 GDPR/Compliance Tools

**Priority:** Low  
**Effort:** Medium (1-2 Weeks)

### Description

Tools to help with data privacy and compliance requirements.

### Planned Features

- **Data Export**
  - User data export
  - Machine-readable format
- **Data Deletion**
  - Deletion workflows
  - Confirmation and audit trail
- **Audit Log Retention**
  - Configurable retention policies
  - Automatic cleanup
- **Cookie Consent**
  - Consent management
  - Banner configuration

---

## How to Contribute Ideas

Have a feature idea? Open an issue on GitHub with the `feature-request` label!

[← Back to Version Overview](/setup/general/versions)
