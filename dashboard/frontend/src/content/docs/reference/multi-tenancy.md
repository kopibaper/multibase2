# Multi-Tenancy & Organisations
description: Organisation model, roles, instance isolation, team invitations — v1.4

**Version:** 1.4 (Planned)  
**Target:** Q2 2026  
**Audience:** Developers & Administrators

> 📋 [Full Technical Specification →](/setup/features/roadmap-1.4)

---

## Overview

Multibase v1.4 introduces **Organisations** — a multi-tenancy layer designed for web agencies
that host Supabase backends on behalf of multiple clients.

Each client registers once, creates a named organisation, and operates in a fully isolated
environment. The agency's global admin retains full visibility across all organisations.

---

## How It Works

### For Clients (End Users)

1. Go to the registration page
2. Enter name, email, password and **organisation name**
3. An organisation is created instantly — the account becomes its `owner`
4. All Supabase instances belong to that organisation
5. Additional team members can be invited with different roles

### For the Agency (Global Admin)

- All organisations are visible in the admin panel
- Can access any org for support
- Can assign resource quotas per org (v1.5)

---

## Organisation Roles

| Role | Description |
|---|---|
| `owner` | Full control including delete org. Created on registration. |
| `admin` | Can create instances and invite members. Cannot delete org. |
| `member` | Can start/stop instances and view logs. Cannot create instances. |
| `viewer` | Read-only access. No actions. |

---

## Registration Flow (v1.4)

```
Old: Name → Email → Password → Account created

New: Name → Email → Password → Organisation Name → Account + Org created
```

The organisation name can be anything (e.g. company name, project name). A URL-safe slug
is generated automatically (e.g. "Mustermann GmbH" → `mustermann-gmbh`).

---

## Instance Isolation

Every Supabase instance belongs to exactly one organisation.

- Users can only see instances of their own organisation
- The API enforces this at middleware level — not just in the UI
- Switching organisations (if a user belongs to multiple) is done via the org switcher in the navbar

---

## Inviting Team Members

The org `owner` or `admin` can invite additional users:

1. Navigate to **Org Settings → Members**
2. Enter the invitee's email address
3. Select a role (`admin`, `member`, `viewer`)
4. Send invite

If SMTP is configured, the invitee receives an email. Otherwise, they can register
and will be linked to the org automatically.

---

## API Endpoints

```
POST   /api/orgs                        Create new organisation
GET    /api/orgs/mine                   List my organisations
GET    /api/orgs/:id                    Get org details
PATCH  /api/orgs/:id                    Update org name
DELETE /api/orgs/:id                    Delete org (owner only, all instances must be deleted first)

GET    /api/orgs/:id/members            List members
POST   /api/orgs/:id/members/invite     Invite member by email
PATCH  /api/orgs/:id/members/:userId    Change member role
DELETE /api/orgs/:id/members/:userId    Remove member
```

All existing `/api/instances` routes automatically scope results to the active organisation.

---

## Migration from v1.3

Existing installations are migrated automatically:

1. A **Default Organisation** is created for the first admin user
2. All existing instances are assigned to this org
3. Existing users are assigned to the default org as `admin`
4. On next login, users are prompted to rename their org if desired

```bash
# Run after updating to v1.4
npx prisma migrate deploy
node scripts/migrate-v1.3-to-v1.4.js
```

---

## Security Notes

- Org scoping is enforced at the API middleware level — bypassing it via the UI is not possible
- Global admins (server-level) can access all orgs and are intended for agency staff only
- Org deletion requires all instances to be stopped and removed first
- JWT tokens include `orgId` and `orgRole` — switching orgs requires a token refresh
