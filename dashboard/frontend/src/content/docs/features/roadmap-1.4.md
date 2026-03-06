---
title: Version 1.4 - Multi-Tenancy & Organisations
description: Organisation model, role-based access, org switcher, member invitations
---

# Version 1.4 — Multi-Tenancy & Organisations

**Status:** ✅ Released  
**Release:** March 2026  
**Use Case:** Web agencies providing managed Supabase backends to their clients

---

## 🎯 Vision

A web agency installs Multibase once on their server. Each client registers an account,
creates their own named **Organisation**, and manages their Supabase instances within it —
completely isolated from other clients. The agency's admin has a global overview of all
organisations and can intervene at any time.

> 📖 [Multi-Tenancy Reference Guide](/setup/reference/multi-tenancy)

---

## 🏢 Organisation Model

### Registration Flow (Updated)

The current registration flow is extended:

1. User fills in: **Name**, **Email**, **Password**
2. User fills in: **Organisation Name** (e.g. "Mustermann GmbH")
3. On submit:
   - Organisation is created with the given name
   - User account is created
   - User is assigned `owner` role in the new organisation
   - User lands on the organisation dashboard

### Data Model

```
Organisation
├── id (uuid)
├── name          (e.g. "Mustermann GmbH")
├── slug          (e.g. "mustermann-gmbh", auto-generated, unique URL key)
├── createdAt
└── updatedAt

OrgMember (join table)
├── orgId         → Organisation
├── userId        → User
├── role          → 'owner' | 'admin' | 'member' | 'viewer'
└── joinedAt

Instance (extended)
└── orgId         → Organisation  (NEW — each instance belongs to one org)
```

### Roles per Organisation

| Role | Create Instance | Start/Stop | View Logs | Manage Members | Delete Org |
|---|:---:|:---:|:---:|:---:|:---:|
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ (except owner) | ❌ |
| `member` | ❌ | ✅ | ✅ | ❌ | ❌ |
| `viewer` | ❌ | ❌ | ✅ | ❌ | ❌ |

> **Global Admin** (server-level): Can see and manage all organisations.
> This role is set directly in the DB and is reserved for the agency's own accounts.

---

## 🔧 Backend Changes

### New API Routes

```
POST   /api/orgs                      Create organisation (on registration)
GET    /api/orgs/mine                 List own organisations
GET    /api/orgs/:id                  Get org details
PATCH  /api/orgs/:id                  Update org name
DELETE /api/orgs/:id                  Delete org (owner only)

GET    /api/orgs/:id/members          List members
POST   /api/orgs/:id/members/invite   Invite user by email
PATCH  /api/orgs/:id/members/:userId  Change member role
DELETE /api/orgs/:id/members/:userId  Remove member

GET    /api/instances                 (Modified) Returns only org-scoped instances
POST   /api/instances                 (Modified) Assigns instance to current org
```

### Middleware Change

Every authenticated request carries the active `orgId` (from JWT or header).
Instance routes automatically filter by org — no instance can be accessed across org boundaries.

### Prisma Schema Additions

```prisma
model Organisation {
  id        String      @id @default(uuid())
  name      String
  slug      String      @unique
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  members   OrgMember[]
  instances Instance[]
}

model OrgMember {
  org       Organisation @relation(fields: [orgId], references: [id], onDelete: Cascade)
  orgId     String
  user      User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String
  role      String       // 'owner' | 'admin' | 'member' | 'viewer'
  joinedAt  DateTime     @default(now())

  @@id([orgId, userId])
}
```

---

## 🖥️ Frontend Changes

### Register Page (Updated)

```
[ Name          ]
[ Email         ]
[ Password      ]
[ Organisation  ]   ← new field
[ Create Account & Organisation ]
```

### Org Switcher (Navbar)

- Dropdown top-left (similar to GitHub)
- Shows current org name + avatar initials
- Switch between orgs if user belongs to multiple
- "Create new organisation" option

### New Pages

- `/orgs/:slug/settings` — Org name, danger zone (delete)
- `/orgs/:slug/members` — Member list, invite, role change
- Dashboard filters instances by active org automatically

### Modified Pages

- **Dashboard** — shows only instances of the active org
- **UserManagement** — becomes Org Member Management (non-global-admin)
- **Register** — adds Organisation Name field

---

## 🔒 Security

- Users can only see organisations they are members of
- Instance API enforces org-scoping at middleware level (not just UI)
- Global admins bypass org scoping (for support/agency use)
- Org deletion is protected: must stop and delete all instances first

---

## 📦 Migration for Existing Installations

```bash
# 1. Run Prisma migration
npx prisma migrate deploy

# 2. Auto-create default org for existing admin
node scripts/migrate-v1.3-to-v1.4.js

# 3. Assign all existing instances to default org
# (handled by migration script)
```

The migration script creates a `Default Organisation` for the first admin user
and assigns all existing instances to it. Existing users without an org are
assigned to a system org and prompted to create/join an org on next login.

---

## 🗺️ Implementation Phases

### Phase 1 — Core (Est. 5–7 days)
- [ ] Prisma schema: `Organisation`, `OrgMember`, extend `Instance`
- [ ] Backend: org CRUD routes, org-scoped instance middleware
- [ ] Register flow: org creation on signup
- [ ] JWT: include `orgId` + `orgRole`
- [ ] Migration script for existing data

### Phase 2 — UI (Est. 3–5 days)
- [ ] Updated Register page with org name field
- [ ] Org switcher in navbar
- [ ] Org settings page (rename, delete)
- [ ] Org member management page (invite, roles)

### Phase 3 — Polish (Est. 2–3 days)
- [ ] Global admin org overview page
- [ ] Org usage stats (instance count, resource usage)
- [ ] Email invitations (if SMTP configured)

---

## 🔮 Future Extensions (v1.5+)

- **Resource Quotas per Org** — max instances, max RAM
- **Billing Integration** — cost per org
- **Audit Log per Org** — activity feed per organisation
- **SSO / OAuth** — login with Google/GitHub mapped to org
