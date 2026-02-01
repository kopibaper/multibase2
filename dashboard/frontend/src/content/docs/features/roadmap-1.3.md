---
title: Version 1.3 - Future Roadmap
description: Planned features for the next major release
---

# Version 1.3 - Feature Roadmap

**Planned Release:** Q4 2026  
**Status:** 💡 Planning Phase

> These features are planned for the next major release.

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
