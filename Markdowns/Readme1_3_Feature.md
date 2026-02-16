# Multibase Dashboard v1.3 - Features

Features and roadmap for version 1.3.

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
