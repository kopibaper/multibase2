# Multibase Dashboard v1.3 - Features

Features and roadmap for version 1.3.  
**Status:** ✅ Released — All core features shipped.

---

## ☁️ **Shared Cloud Infrastructure** ✅

### **Description**

Centralized shared services architecture that eliminates per-tenant duplicates. Instead of 12+ containers per project, tenants now run only 5 containers while sharing 8 infrastructure services.

### **Features**

- ✅ **8 Shared Services**: PostgreSQL, Studio, Analytics, Vector, imgproxy, Pooler (Supavisor), Meta, Nginx Gateway
- ✅ **5 Per-Tenant Services**: Auth (GoTrue), REST (PostgREST), Realtime, Storage, Edge Functions
- ✅ **Resource Savings**: ~7 GiB RAM saved for 5 tenants vs. classic deploy
- ✅ **Automatic Bootstrapping**: `setup_shared.py start` provisions shared stack + generates nginx config
- ✅ **SharedInfra Dashboard**: Web UI showing all 8 services with start/stop/restart controls
- ✅ **Resource Monitoring**: Aggregated CPU & RAM GaugeCharts for the entire shared stack

### **Priority**: High

### **Effort**: Completed

> 📖 Implementation Log: [CLOUD_ARCHITECTURE.md](./CLOUD_ARCHITECTURE.md)

---

## 🔀 **Kong → Nginx Gateway Migration** ✅

### **Description**

Replaced all per-tenant Kong API gateways with a single shared Nginx reverse proxy. The gateway handles routing for all tenants via dynamic upstream resolution.

### **Features**

- ✅ **Single Gateway**: One Nginx container replaces N Kong containers
- ✅ **Dynamic Routing**: `set $upstream` + `resolver 127.0.0.11` for deferred DNS
- ✅ **Auto-Config Generation**: `setup_shared.py` generates nginx conf per tenant on start/create
- ✅ **Health Checks**: Built-in upstream health monitoring
- ✅ **Backward Compatible**: Same API URLs, same port layout (`:8000` gateway)
- ✅ **RAM Savings**: ~1.4 GiB per tenant (Kong removed entirely)

### **Priority**: High

### **Effort**: Completed

> 📖 Migration Reference: [KONG_NGINX_MIGRATION.md](./KONG_NGINX_MIGRATION.md)

---

## 🖥️ **Workspace Page** ✅

### **Description**

Unified project management interface combining all project-level operations in a single view with sidebar navigation.

### **Features**

- ✅ **Project Sidebar**: Searchable project list with status indicators
- ✅ **Studio Integration**: One-click Supabase Studio activation per project
- ✅ **API Keys Modal**: Quick-access to project JWT, anon/service keys
- ✅ **SMTP Settings**: Per-project email configuration panel
- ✅ **Manager Tab**: Instance lifecycle controls (start, stop, restart, delete)

### **Priority**: High

### **Effort**: Completed

---

## 🤖 **AI Chat Agent** ✅

### **Description**

Integrated AI assistant for natural-language infrastructure management. Supports multi-provider LLMs with tool calling to operate all Supabase instances directly from the chat panel.

### **Features**

- ✅ **Multi-Provider Support**: OpenAI, Anthropic, Google Gemini, OpenRouter (incl. Llama, Mistral, DeepSeek)
- ✅ **30+ Tools**: Instance CRUD, backups, storage, SQL execution, logs, metrics, templates, alerts
- ✅ **Destructive Action Confirmation**: Dangerous operations require explicit user approval
- ✅ **Session Management**: Persistent chat history per user with multiple sessions
- ✅ **SSE Streaming**: Real-time response streaming via Server-Sent Events
- ✅ **Encrypted Key Storage**: User API keys encrypted at rest (AES-256-GCM)
- ✅ **Rate Limiting**: 50 messages/hour per user

### **Priority**: High

### **Effort**: Completed

> 📖 Full technical documentation: [AIchat.md](./AIchat.md)

---

## 🏢 **Multi-Tenancy/Teams**

### **Description**

Support for multiple teams/organizations on a single installation with isolated instances.

### **Features**

- **Organization/Team Management**
  - Create and manage teams
  - Roles per Team (Owner, Admin, Member, Viewer)
- **Instance Isolation**
  - Instances assigned to a team
  - Team members only see their team's instances
- **Resource Quotas**
  - Limits per team (CPU, RAM, Storage)

### **Priority**: Medium

### **Effort**: High (2-3 Weeks)

---

## 💰 **Cost Tracking & Billing**

### **Description**

Track resource usage and generate billing reports.

### **Features**

- **Resource Tracking**: CPU, Memory, Storage, Network.
- **Cost Calculation**: Configurable prices, monthly reports.
- **Budget Management**: Set limits and alerts.
- **Billing Export**: Invoices and Payment Gateway integration.

### **Priority**: Low

### **Effort**: High (3-4 Weeks)

---

## 💾 **S3 Storage Integration**

### **Description**

Store backups and large files in S3-compatible storage.

### **Features**

- **Support**: AWS S3, MinIO, Backblaze B2.
- **Offload**: Automatic backup offloading.

### **Priority**: Medium

### **Effort**: Medium (1 Week)

---

## 🔒 **GDPR/Compliance Tools**

### **Description**

Tools for data privacy and compliance.

### **Features**

- **Data Export**: User data export (machine-readable).
- **Data Deletion**: Workflows with audit trail.
- **Cookie Consent**: Management and banner config.

### **Priority**: Low

### **Effort**: Medium (1-2 Weeks)

---

[Back to Version Overview](./VERSION_OVERVIEW.md)
