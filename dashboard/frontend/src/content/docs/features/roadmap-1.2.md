---
title: Version 1.2 - Implemented Features
description: Overview of features released in Version 1.2
---

# Version 1.2 - Feature Overview

**Release:** February 2026  
**Status:** ✅ Released

> All features in this version have been implemented and are available for use.

---

## 💾 Storage Manager Improvements

**Status:** ✅ Implemented  
**Priority:** High

### Description

Enhanced file manager for object storage with folder support, security features, and improved UX.

### Features

- **Folder Management**
  - Create virtual folders to organize files.
  - Breadcrumb navigation for deep structures.
- **File Operations**
  - **Upload/Download**: Seamless file handling.
  - **Image Previews**: Automatic thumbnails and modal usage for images.
  - **Interaction**: Click-to-preview for images, click-to-download for files.
- **Security**
  - **Signed URLs**: Private files are accessed via secure, temporary signed URLs.
  - **S3 Compatibility**: Integrated support for S3-compatible storage.
  - **Access Control**: Respects bucket privacy settings.
  - **Custom Confirmation**: Accidental deletion protection with custom modals.

---

## 📊 Advanced Monitoring

**Status:** ✅ Implemented  
**Priority:** Medium

### Description

Extended monitoring capabilities.

### Features

- **Expanded Metrics**
  - Detailed resource usage views.
- **Live Updates**
  - Real-time status reflection via WebSockets.
- **Log Management**
  - View and search application logs.

---

## 🔐 RLS Policies & Security

**Status:** ✅ Implemented
**Priority:** High

### Description

Advanced database security and policy management.

### Features

- **Policy Manager**
  - View, Enable, Disable RLS policies per table.
  - **Policy Editor**: Create and edit SQL policies directly.
  - **Templates**: Common policy templates (e.g., "Public Read", "Authenticated Insert").

---

## 🔄 Bulk Actions

**Status:** ✅ Implemented
**Priority:** Medium

### Description

Perform operations on multiple instances simultaneously.

### Features

- **Batch Operations**
  - **Start/Stop**: Control multiple instances at once.
  - **Delete**: Bulk deletion with confirmation.
- **UI Improvements**
  - Selection checkboxes on instance cards.
  - Floating action bar for quick access.

---

## 🎛️ Resource Limits

**Status:** ✅ Implemented
**Priority:** High

### Description

Control system resource usage per instance.

### Features

- **Docker Constraints**
  - **CPU Limits**: Restrict CPU usage (e.g., 0.5 vCPU).
  - **Memory Limits**: Set RAM quotas (e.g., 512MB).
- **Configuration**
  - Configurable during creation and editing.

---

## ☁️ Edge Functions Manager

**Status:** ✅ Implemented
**Priority:** Medium

### Description

Manage Supabase Edge Functions.

### Features

- **Function Ops**
  - Create, Deploy, and Delete functions.
  - **Code Editor**: Simple in-browser editor for function code.
- **Observability**
  - **Execution Logs**: View real-time function logs.

---

## 🔧 Environment & SMTP Templates

**Status:** ✅ Implemented
**Priority:** Medium

### Description

Configuration and communication tools.

### Features

- **Environment Manager**
  - Manage `.env` file content safely from the dashboard.
- **SMTP Templates**
  - **Template Editor**: Customize email templates (Verification, Password Reset).
  - **Variables**: Support for dynamic placeholders (`{{ .ConfirmationURL }}`, etc.).

---

## 📦 Instance Cloning & Snapshots

**Status:** ✅ Implemented  
**Priority:** Low

### Description

Tools for managing instance state and replication.

### Features

- **Cloning**
  - Duplicate existing instances to create identical copies.
- **Snapshots**
  - Create point-in-time snapshots of instance state (if supported by backend).

---

## Next Version

See [Version 1.3 Roadmap](/setup/features/roadmap-1.3) for planned future features including Multi-Tenancy and S3 Integration.

[← Back to Version Overview](/setup/general/versions)
