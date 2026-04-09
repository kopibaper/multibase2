# Extension Marketplace

## Übersicht

Der Extension Marketplace ermöglicht es, vorgefertigte SQL-Schemas, Edge Functions und Konfigurationen mit einem Klick auf beliebige Supabase-Instanzen zu installieren. Extensions werden zentral verwaltet, versioniert und können jederzeit deinstalliert werden.

---

## Architektur

```
┌─────────────────────────────────────────────────────┐
│                  Extension Marketplace               │
│              /dashboard/frontend/src/pages/          │
│                  MarketplacePage.tsx                 │
└────────────────────┬────────────────────────────────┘
                     │  GET /api/marketplace/extensions
                     ▼
┌─────────────────────────────────────────────────────┐
│              Backend API                             │
│  /dashboard/backend/src/routes/marketplace.ts        │
│  /dashboard/backend/src/routes/extensions.ts         │
└────────────────────┬────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
┌──────────────────┐  ┌──────────────────────────────┐
│  Extension DB    │  │  ExtensionService             │
│  (SQLite/Prisma) │  │  - Manifest laden             │
│  51 Extensions   │  │  - Config interpolieren       │
│                  │  │  - SQL ausführen              │
└──────────────────┘  │  - Functions deployen         │
                      └──────────┬───────────────────┘
                                 │
                                 ▼
                      ┌──────────────────────────────┐
                      │  Static File Server           │
                      │  localhost:3001/extensions/   │
                      │  manifest.json + schema.sql   │
                      │  + rollback.sql + index.ts    │
                      └──────────────────────────────┘
```

---

## Extension-Typen

| Typ | Was passiert bei Installation |
|-----|-------------------------------|
| `sql` | SQL-Datei wird auf der Postgres-Instanz ausgeführt |
| `config` | Umgebungsvariablen der Instanz werden gesetzt |
| `function` | TypeScript-Code wird als Edge Function deployed |
| `composite` | Kombination aus SQL + Function + Config |

---

## Manifest-Format

Jede Extension hat eine `manifest.json` unter `backend/extensions/{id}/`:

```json
{
  "id": "ecommerce-starter",
  "version": "1.3.0",
  "requirements": {
    "postgresExtensions": ["pgcrypto", "uuid-ossp"]
  },
  "install": {
    "type": "sql",
    "steps": [
      { "label": "Create tables", "file": "schema.sql" }
    ],
    "rollback": "rollback.sql"
  }
}
```

Config-Werte aus dem Installations-Wizard werden als `{{variableName}}` in SQL-Dateien interpoliert:

```sql
CREATE SCHEMA IF NOT EXISTS {{schemaName}};
CREATE TABLE {{schemaName}}.products ( ... );
```

---

## Verfügbare Extensions (51)

### 🗄️ Database (10)
| Extension | Beschreibung | Typ |
|-----------|-------------|-----|
| E-Commerce Starter | Produkte, Bestellungen, Kunden, Inventar | sql |
| Blog & CMS | Posts, Kategorien, Tags, Kommentare | sql |
| SaaS Starter | Orgs, Subscriptions, Feature-Flags | sql |
| Multi-Tenant Base | Row-Level-Isolation, Tenant-Management | sql |
| Audit Trail | GDPR-ready Änderungshistorie via Trigger | sql |
| Address Book | Kontakte, Adressen, Geocoding | sql |
| Booking System | Ressourcen, Zeitslots, Reservierungen | sql |
| Notification Center | In-App, E-Mail, Push mit Präferenzen | sql |
| Survey Builder | Fragen, Logik-Sprünge, Antworten | sql |
| Workflow Engine | State-Machine für beliebige Prozesse | sql |

### 🔐 Auth (7)
| Extension | Beschreibung | Typ |
|-----------|-------------|-----|
| Social Login Bundle | Google, GitHub, Discord OAuth | config |
| Enterprise SSO | SAML für Azure AD, Okta, Google Workspace | config |
| 2FA Enforcement | TOTP-Pflicht mit Grace-Period | composite |
| Phone Authentication | SMS-OTP via Twilio | composite |
| Passkey / WebAuthn | Biometrischer Login (FIDO2) | composite |
| IP Allowlist | Zugriffsbeschränkung per CIDR | composite |
| Session Manager | Geräte-Verwaltung, Concurrent-Session-Limit | composite |

### ⚡ Functions (9)
| Extension | Beschreibung | Typ |
|-----------|-------------|-----|
| Stripe Webhooks | Payment-Events → Datenbank | composite |
| Resend Transactional | E-Mail-Templates bei DB-Events | function |
| Slack Notifier | Slack-Nachrichten bei DB-Events | function |
| PDF Generator | HTML → PDF via Browserless | function |
| Image Optimizer | WebP-Konvertierung bei Storage-Upload | composite |
| OpenAI Proxy | Rate-Limiting, Kosten-Tracking | composite |
| Webhook Dispatcher | Retry-Logic, HMAC-Signing | composite |
| URL Shortener | Kurz-URLs mit Click-Analytics | composite |
| File Processor | Validierung, Metadaten, Virenscan | composite |

### 📊 Monitoring (5)
| Extension | Beschreibung | Typ |
|-----------|-------------|-----|
| Grafana Dashboard | Vorgefertigtes Dashboard | config |
| Uptime Kuma | Monitoring-Konfiguration | config |
| Sentry Integration | Error-Tracking für Edge Functions | function |
| Slow Query Tracker | pg_stat_statements + Alerts | composite |
| Table Size Monitor | Wachstums-Analyse + Alerts | composite |

### 🤖 AI / Vectors (6)
| Extension | Beschreibung | Typ |
|-----------|-------------|-----|
| RAG Starter | Dokument-Upload → Embedding → Suche | composite |
| Semantic Search | pgvector auf beliebige Textspalten | composite |
| AI Chat History | Persistente LLM-Konversationen | sql |
| Knowledge Base | Vektorsuche + Volltextsuche | composite |
| AI Image Analysis | GPT-4o Vision bei Storage-Upload | composite |
| Content Summarizer | Automatische Zusammenfassung via Trigger | composite |

### 💾 Storage (3)
| Extension | Beschreibung | Typ |
|-----------|-------------|-----|
| S3 Mirror | Automatische Synchronisation zu AWS S3/R2/B2 | composite |
| CDN Cache Purge | Invalidierung bei Storage-Änderungen | function |
| Storage Analytics | Nutzungsanalyse + Kosten-Alerts | composite |

---

## Sicherheit

- **SQL-Injection**: Geblockte Patterns (DROP DATABASE, ALTER SYSTEM, COPY TO/FROM, ...)
- **SSRF-Prävention**: Manifest-URLs nur von Allow-List (`localhost`, `cdn.multibase.dev`)
- **Rate-Limiting**: Max. 3 Installationen pro Instanz pro Stunde
- **Audit-Log**: Jede Installation/Deinstallation wird protokolliert
- **RLS**: Alle Extensions aktivieren Row Level Security wo sinnvoll

---

## Datenbankmodelle

```
Extension                    InstalledExtension
──────────────────────       ─────────────────────────
id (TEXT, PK)                id (UUID, PK)
name                         instanceId (FK → Instance)
description                  extensionId (FK → Extension)
version                      version
author                       status: active|error|updating|disabled
category                     config (JSON)
installType                  installedAt
manifestUrl                  updatedAt
configSchema (JSON)
installCount
rating
featured / verified
```

---

## Lokaler Extension-Server

Extensions werden von `localhost:3001/extensions/{id}/` geladen. Der Express-Server liefert die Dateien statisch aus `backend/extensions/`:

```
backend/extensions/
├── ecommerce-starter/
│   ├── manifest.json
│   ├── schema.sql
│   └── rollback.sql
├── stripe-webhooks/
│   ├── manifest.json
│   ├── schema.sql
│   ├── rollback.sql
│   └── index.ts          ← Edge Function Code
└── social-login-bundle/
    └── manifest.json     ← Config-only, kein SQL
```

Der Marketplace wird beim Serverstart automatisch aus `src/data/marketplace-extensions.ts` synchronisiert (Upsert aller 51 Extensions).

---

## Verwandte Dateien

| Datei | Zweck |
|-------|-------|
| `backend/src/services/ExtensionService.ts` | Installations-Logik |
| `backend/src/routes/marketplace.ts` | API für Extension-Katalog |
| `backend/src/routes/extensions.ts` | API für installierte Extensions |
| `backend/src/data/marketplace-extensions.ts` | Seed-Daten (51 Extensions) |
| `backend/extensions/` | Manifest- und SQL-Dateien |
| `frontend/src/pages/MarketplacePage.tsx` | Marketplace-UI |
| `frontend/src/components/marketplace/ExtensionCard.tsx` | Extension-Karte |
| `frontend/src/components/marketplace/ExtensionDetailModal.tsx` | Installations-Wizard |
| `frontend/src/components/ExtensionsTab.tsx` | Installierte Extensions |
