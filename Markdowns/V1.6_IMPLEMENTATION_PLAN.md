# V1.6 Implementation Plan — Feature-Roadmap

> Detaillierter Frontend & Backend Implementationsplan basierend auf der bestehenden Projektstruktur.
> Stand: März 2026

---

## Überblick der v1.6 Features

| # | Feature | Platzierung | Aufwand | Priorität | Status |
|---|---------|-------------|---------|-----------|--------|
| 1 | Auth-Tab im Workspace (Auth-Tab aus InstanceDetail entfernen) | `WorkspaceProjectPage` Sidebar | Klein | Hoch | ✅ |
| 2 | Auth-Erweiterungen (Phone Twilio, CAPTCHA, Magic Link HTML, SAML SSO) | `AuthTab.tsx` (Erweiterung) | Mittel | Hoch | ✅ |
| 3 | Custom Domains (DNS-Check + Certbot) | Neuer Tab `domains` im Workspace | Mittel | Hoch | ✅ |
| 4 | Environment-Labels & Clone-Shortcuts | `WorkspaceProjectsPage` + DB-Schema | Klein | Mittel | ✅ |
| 5 | Storage: Tus Resumable Uploads + Nginx CDN Cache | `StorageTab.tsx` (Erweiterung) | Mittel | Mittel | ✅ |
| 6 | Vault Secrets UI + Doku | Neuer Tab `vault` im Workspace | Klein | Mittel | ✅ |
| 7 | Network Restrictions (IP-Whitelist + SSL-Enforcement) | Neuer Tab `security` im Workspace | Klein | Mittel | ✅ |

---

## Architektur-Überblick

### Aktuelle Workspace Sidebar (v1.5)

```
/workspace/projects/:project/:tab
  Sidebar-Tabs: overview | database | storage | policies | functions |
                webhooks | cron | vectors | queues | api | smtp | keys
```

### Neue Workspace Sidebar (v1.6)

```
/workspace/projects/:project/:tab
  Sidebar-Tabs: overview | database | storage | policies | functions |
                webhooks | cron | vectors | queues | api | smtp | keys |
                ─── Separator ───
                auth | vault | domains | security
```

Neue Tabs am Ende der Sidebar, gruppiert unter einem visuellen Separator
("Configuration" oder ähnlich).

### InstanceDetail Änderungen

- `AuthTab` wird aus `InstanceDetail.tsx` entfernt (der Tab war dort unter "Auth")
- Die Funktionalität lebt ab v1.6 ausschließlich im Workspace unter `/workspace/projects/:name/auth`

---

## Feature 1 — Auth-Tab im Workspace

### Platzierung
**`dashboard/frontend/src/pages/WorkspaceProjectPage.tsx`** — neuer Tab `auth` in der Sidebar.

### Ziel
`AuthTab.tsx` ist vollständig implementiert, aber er ist momentan nur in `InstanceDetail.tsx`  
eingebunden, nicht im neuen Workspace. Dieser Task verschiebt ihn in den Workspace.

### Frontend Tasks

**Datei:** `dashboard/frontend/src/pages/WorkspaceProjectPage.tsx`

```
Task FE-1.1: Auth-Tab zur Sidebar hinzufügen
  - Sidebar-Eintrag "Auth" mit Shield-Icon nach dem letzten separator einfügen
  - Tab-Wert: 'auth'
  - Render-Case: <AuthTab instance={instance} />
  - Import: AuthTab aus '../components/AuthTab'
```

**Datei:** `dashboard/frontend/src/pages/InstanceDetail.tsx`

```
Task FE-1.2: Auth-Tab aus InstanceDetail entfernen
  - Import und Tab-Definition für AuthTab entfernen
  - Den "Auth"-Tab-Eintrag aus der Tab-Liste entfernen
  - Auth-Tab Content-Render entfernen
```

### Backend Tasks

Keine — `AuthTab.tsx` nutzt bereits `instancesApi.getEnv()` und `instancesApi.updateEnv()`,
beide Endpoints existieren.

---

## Feature 2 — Auth-Erweiterungen

### Platzierung
**`dashboard/frontend/src/components/AuthTab.tsx`** — Erweiterung bestehender Sections
sowie neue Sections.

### Was bereits vorhanden ist (nicht anfassen)
- OAuth Provider (Google, GitHub, Discord, Facebook, Twitter, GitLab, Bitbucket, Apple)
- Email-Signup Toggle + Confirm Email Toggle
- Custom SMTP Settings
- Email Template Subjects (Confirmation, Recovery, Invite, Magic Link)
- Phone Signup Toggle (`GOTRUE_EXTERNAL_PHONE_ENABLED`)
- Anonymous Signins Toggle
- Site URL

### Was neu hinzukommt

#### 2a — Phone Login Provider Config

Die bestehende Security-Section hat bereits einen "Enable Phone Signup"-Toggle.
Darunter wird, wenn aktiviert, eine Konfigurationssektion für den SMS-Provider sichtbar.

**GoTrue ENV-Variablen:**

```
GOTRUE_SMS_TWILIO_ACCOUNT_SID
GOTRUE_SMS_TWILIO_AUTH_TOKEN
GOTRUE_SMS_TWILIO_MESSAGE_SERVICE_SID
# Alternative: MessageBird
GOTRUE_SMS_MESSAGEBIRD_ACCESS_KEY
GOTRUE_SMS_MESSAGEBIRD_ORIGINATOR
# Alternative: Vonage
GOTRUE_SMS_VONAGE_API_KEY
GOTRUE_SMS_VONAGE_API_SECRET
GOTRUE_SMS_VONAGE_FROM
```

```
Task FE-2.1: Phone Provider Config in Security-Section ergänzen
  - Provider-Dropdown: Twilio / MessageBird / Vonage
  - Felder je nach Auswahl ein-/ausblenden
  - Animate-in wenn Phone Signup Toggle an
  - ENV: GOTRUE_SMS_PROVIDER (gesetzt auf 'twilio' / 'messagebird' / 'vonage')
  - Test-OTP Feld optional: GOTRUE_SMS_TEST_OTP
```

#### 2b — Magic Link HTML-Template Bodies

Die "Email Templates & URLs"-Section zeigt bereits die Mail-Subjects.
Darunter werden textarea-Felder für die Template-Bodies hinzugefügt.

**GoTrue ENV-Variablen:**

```
GOTRUE_MAILER_TEMPLATES_CONFIRMATION
GOTRUE_MAILER_TEMPLATES_RECOVERY
GOTRUE_MAILER_TEMPLATES_INVITE
GOTRUE_MAILER_TEMPLATES_MAGIC_LINK
GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE
```

```
Task FE-2.2: HTML-Template-Bodies als Textareas in Templates-Section ergänzen
  - Pro Template-Typ: Textarea mit 6 Zeilen (monospace Font)
  - Placeholder: Standard GoTrue HTML-Template als Beispiel
  - Hinweis-Banner: "Must contain {{ .ConfirmationURL }} placeholder"
  - Token-Referenz Link zur GoTrue-Doku
```

#### 2c — CAPTCHA Integration

**GoTrue ENV-Variablen:**

```
GOTRUE_SECURITY_CAPTCHA_ENABLED
GOTRUE_SECURITY_CAPTCHA_PROVIDER     # 'hcaptcha' | 'turnstile'
GOTRUE_SECURITY_CAPTCHA_SECRET
```

```
Task FE-2.3: Neue CAPTCHA-Section in Security-Bereich
  - Enable/Disable Toggle
  - Provider-Auswahl: hCaptcha / Cloudflare Turnstile
  - Secret-Key Eingabefeld (type=password)
  - Info: "Site Key muss im Frontend der Applikation konfiguriert werden"
```

#### 2d — SAML SSO

**GoTrue ENV-Variablen:**

```
GOTRUE_SAML_ENABLED
GOTRUE_SAML_METADATA_URL     # IdP Metadata-URL
GOTRUE_SAML_PRIVATE_KEY      # RSA Private Key (PEM)
```

```
Task FE-2.4: SAML SSO Section — neuer Abschnitt in AuthTab
  - Enable/Disable Toggle
  - IdP Metadata URL Feld
  - Private Key Textarea (PEM-Format)
  - Hinweis: "Erfordert GoTrue v2.x mit SAML-Unterstützung"
  - Link zu GoTrue SAML Dokumentation
```

### Backend Tasks

```
Task BE-2.1: Keine neuen Endpoints nötig
  - Alle SAML/CAPTCHA/Phone/Template ENV-Variablen werden über
    den bestehenden PATCH /api/instances/:name/env Endpoint gesetzt
  - GoTrue liest ENV-Vars und aktiviert Features beim Neustart
```

---

## Feature 3 — Custom Domains

### Platzierung
**Neuer Tab `domains`** in `WorkspaceProjectPage.tsx`.  
**Neuer Backend-Service:** `CustomDomainService.ts`  
**Neue Backend-Route:** `/api/instances/:name/domains`

### Konzept für Self-Hosting

Ein User möchte seine Instanz unter `api.meine-firma.de` erreichbar machen statt unter
`mein-projekt.rootdomain.com`. Der Ablauf:

1. User trägt die gewünschte Domain ein (z.B. `api.meine-firma.de`)
2. System zeigt welchen CNAME-Record der User bei seinem DNS-Provider setzen muss
3. User setzt den CNAME: `api.meine-firma.de  CNAME  mein-projekt.rootdomain.com`
4. System prüft per DNS-Lookup ob der Record gesetzt ist (Backend macht `dns.resolve()`)
5. Bei Erfolg: Certbot holt SSL-Zertifikat für die Custom Domain
6. Nginx-Config wird um die zusätzliche `server_name` ergänzt und neu geladen

### Frontend Tasks

**Neue Datei:** `dashboard/frontend/src/pages/workspace-tabs/DomainsPanel.tsx`

```
Task FE-3.1: DomainsPanel Komponente erstellen
  - Anzeige der aktuellen Subdomain (read-only, z.B. "mein-projekt.rootdomain.com")
  - "Add Custom Domain" Section
    - Text-Input für die gewünschte Custom Domain
    - "Add Domain" Button → triggert POST /api/instances/:name/domains
  - Liste bestehender Custom Domains mit Status-Badge
    - Status: 'pending_dns' | 'dns_verified' | 'ssl_pending' | 'active' | 'error'
    - "Check DNS" Button bei pending_dns
    - "Verify & Issue SSL" Button bei dns_verified
    - "Remove" Button mit Confirm-Dialog
  - DNS-Anleitung: CNAME-Wert anzeigen wenn Domain hinzugefügt
```

**Datei:** `dashboard/frontend/src/pages/WorkspaceProjectPage.tsx`

```
Task FE-3.2: Domains-Tab in Sidebar hinzufügen
  - Tab-Eintrag: 'domains' mit Globe-Icon
  - Import: DomainsPanel
  - Render-Case hinzufügen
```

**Datei:** `dashboard/frontend/src/lib/api.ts`

```
Task FE-3.3: domainsApi Namespace hinzufügen
  - domainsApi.list(instanceName)
  - domainsApi.add(instanceName, domain)
  - domainsApi.checkDns(instanceName, domain)
  - domainsApi.issueSsl(instanceName, domain)
  - domainsApi.remove(instanceName, domain)
```

### Backend Tasks

**Neue Datei:** `dashboard/backend/src/services/CustomDomainService.ts`

```
Task BE-3.1: CustomDomainService erstellen
  - Methoden:
    addDomain(instanceName, domain) → speichert in DB, Status: pending_dns
    checkDns(instanceName, domain) → dns.resolve(domain, 'CNAME') prüft ob
      der CNAME auf die Multibase-Root-Domain zeigt
    issueSsl(instanceName, domain) → execAsync('sudo certbot certonly --nginx -d domain')
    activateDomain(instanceName, domain) → ergänzt Nginx-Config um server_name und reloaded
    removeDomain(instanceName, domain) → Nginx-Config bereinigen + Certbot-Cert löschen
```

**Neue Datei:** `dashboard/backend/src/routes/domains.ts`

```
Task BE-3.2: createDomainRoutes() implementieren
  GET    /api/instances/:name/domains        → list
  POST   /api/instances/:name/domains        → add
  POST   /api/instances/:name/domains/:domain/check-dns   → checkDns
  POST   /api/instances/:name/domains/:domain/issue-ssl   → issueSsl
  DELETE /api/instances/:name/domains/:domain → remove
  
  Alle Routes: requireAuth middleware
  Return-Pattern: return res.json(...) (wegen noImplicitReturns)
```

**Datei:** `dashboard/backend/src/server.ts`

```
Task BE-3.3: Route in server.ts registrieren
  app.use('/api/instances/:name/domains', createDomainRoutes(customDomainService))
```

**Datei:** `dashboard/backend/prisma/schema.prisma`

```
Task BE-3.4: CustomDomain Model hinzufügen
  model CustomDomain {
    id           String   @id @default(cuid())
    instanceName String
    domain       String
    status       String   @default("pending_dns")
    sslIssuedAt  DateTime?
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt
    @@unique([instanceName, domain])
  }
```

---

## Feature 4 — Environment-Labels & Clone-Shortcuts

### Platzierung
**`dashboard/frontend/src/pages/WorkspaceProjectsPage.tsx`** — Badges auf Projekt-Cards.  
**`dashboard/backend/prisma/schema.prisma`** — neues `environment`-Feld am Instance-Model.

### Konzept

Jede Instanz bekommt ein optionales `environment`-Label: `production`, `staging`, `dev`, `preview`.
Labels sind farblich kodiert:
- `production` → rot/orange Badge (warnt bei destruktiven Aktionen)
- `staging` → gelb Badge
- `dev` → blau Badge
- `preview` → lila Badge

Auf der WorkspaceProjectsPage gibt es im Kebab-Menü der Projekt-Card:
- "Set as Production", "Set as Staging", "Set as Dev"
- "Clone as Staging" → klont Instanz, setzt Label `staging`, Name: `instanzname-staging`
- "Clone as Dev" → klont Instanz, setzt Label `dev`, Name: `instanzname-dev`

### Frontend Tasks

**Datei:** `dashboard/frontend/src/pages/WorkspaceProjectsPage.tsx`

```
Task FE-4.1: Environment-Badge auf Projekt-Cards
  - Kleines Badge neben dem Namen der Instanz
  - Farben: production=red/orange, staging=yellow, dev=blue, preview=purple
  - Kein Badge wenn kein Environment gesetzt

Task FE-4.2: Environment-Aktionen im Projekt-Kontextmenü
  - Dropdown-Menü auf der Karte mit "Set Environment" Submenu
  - "Clone as Staging" / "Clone as Dev" Menüpunkte
  - Clone-Aktionen zeigen einen Confirm-Dialog mit neuem Namen (editierbar)
```

**Datei:** `dashboard/frontend/src/lib/api.ts`

```
Task FE-4.3: environmentApi Namespace
  - environmentApi.setLabel(instanceName, label)
  - environmentApi.cloneAs(instanceName, targetLabel) → nutzt bestehenden clone Endpoint
```

### Backend Tasks

**Datei:** `dashboard/backend/prisma/schema.prisma`

```
Task BE-4.1: environment Feld zum Instance-Model hinzufügen
  model Instance {
    ...
    environment String? // 'production' | 'staging' | 'dev' | 'preview' | null
    ...
  }
```

**Datei:** `dashboard/backend/src/routes/instances.ts`

```
Task BE-4.2: PATCH /api/instances/:name/environment Endpoint
  - Body: { environment: string | null }
  - Validierung: enum check
  - Prisma update instanceRecord.environment
  - return res.json({ environment })
```

**Datei:** `dashboard/backend/src/services/InstanceManager.ts`

```
Task BE-4.3: getInstances() gibt environment-Feld mit zurück
  - Prisma-Query: select environment in getInstance und listInstances
```

---

## Feature 5 — Storage: Tus Resumable Uploads + Nginx CDN Cache

### Platzierung
**`dashboard/frontend/src/components/StorageTab.tsx`** — Erweiterung des Upload-Mechanismus.
**`dashboard/backend/src/services/NginxGatewayGenerator.ts`** — CDN-Cache-Header ergänzen.

### Teilfeature 5a — Tus Resumable Uploads

#### Konzept

Supabase Storage unterstützt Tus intern bereits unter `/storage/v1/upload/resumable`.
Die Frontend-Integration nutzt die `@uppy/tus` Bibliothek. Ab einer konfigurierbaren
Dateigröße (Standard: 6 MB) wird automatisch Tus statt Standard-POST genutzt.

**Ablauf:**
1. User wählt Datei im StorageTab
2. Wenn Datei > 6 MB: Tus-Upload via `@uppy/tus`
3. Fortschrittsbalken zeigt Prozent
4. Bei Verbindungsabbruch: Automatisches Resume beim nächsten Versuch
5. Wenn Datei ≤ 6 MB: Bisheriger POST-Upload (kein Tus-Overhead)

#### Frontend Tasks

```
Task FE-5.1: @uppy/core + @uppy/tus installieren
  npm install @uppy/core @uppy/tus
```

**Datei:** `dashboard/frontend/src/components/StorageTab.tsx`

```
Task FE-5.2: Tus-Upload-Logik integrieren
  - Neue Funktion uploadFileTus(file, bucketId, path, instanceUrl, serviceKey)
  - Uppy-Instanz mit TusPlugin konfigurieren
  - Endpoint: ${instanceUrl}/storage/v1/upload/resumable
  - Headers: Authorization: Bearer ${serviceKey}
  - Upload-Size-Threshold: 6MB Konstante (RESUMABLE_THRESHOLD_BYTES)
  - handleFileUpload: if file.size >= RESUMABLE_THRESHOLD_BYTES → uploadFileTus

Task FE-5.3: Fortschritts-Anzeige im Upload-Button
  - Während Tus-Upload: Fortschrittsbalken statt Spinner
  - Prozentzahl anzeigen: "47%"
  - Cancel-Button bei laufendem Upload
```

#### Backend Tasks

```
Task BE-5.1: Tus-Endpoint Proxy sicherstellen
  - Prüfen ob der Nginx-Gateway-Template /storage/v1/upload/resumable durchleitet
  - Falls nicht: Route im Nginx-Template ergänzen
  - Kein neuer Backend-Endpoint nötig (Supabase Storage Container handelt es)
```

### Teilfeature 5b — Nginx CDN Cache-Header

#### Konzept

Öffentliche Storage-Buckets bekommen Cache-Control Header im Nginx-Gateway,
damit Dateien vom Browser gecacht werden. Für private Buckets kein Caching.

**Nginx-Ergänzung im Gateway-Template:**

```nginx
# Storage public assets — cache 24h
location /storage/v1/object/public/ {
    proxy_pass http://...-storage:5000;
    proxy_cache_valid 200 24h;
    add_header Cache-Control "public, max-age=86400, stale-while-revalidate=3600";
    add_header X-Cache-Status $upstream_cache_status;
}
```

#### Frontend Tasks

**Neue Datei:** `dashboard/frontend/src/pages/workspace-tabs/StorageCachePanel.tsx`

```
Task FE-5.4: StorageCachePanel — Sub-Tab in StorageTab
  - Einstellungen für Cache-Verhalten pro Instanz
  - Toggle: "Enable CDN Cache for public buckets"
  - Cache-TTL Eingabe (Stunden, Default 24h)  → schreibt ENV-Var STORAGE_CDN_CACHE_TTL
  - "Invalidate Cache" Button → POST /api/instances/:name/storage/cache/invalidate
  - Status-Anzeige: X-Cache-Status (HIT/MISS/BYPASS) aus Response-Headers
```

#### Backend Tasks

**Datei:** `dashboard/backend/src/services/NginxGatewayGenerator.ts`

```
Task BE-5.2: CDN Cache-Header in Gateway-Template ergänzen
  - Wenn STORAGE_CDN_CACHE_TTL gesetzt: Cache-Control Header für /storage/v1/object/public/
  - Nginx proxy_cache_valid anpassen
  - generateNginxGatewayConfig() erhält neuen Parameter: cdnCacheTtl?: number

Task BE-5.3: Cache-Invalidierung Route
  POST /api/instances/:name/storage/cache/invalidate
  → löscht nginx proxy_cache (nginx -s reload ist ausreichend in Docker-Setup)
  → return res.json({ message: 'Cache invalidated' })
```

---

## Feature 6 — Vault Secrets UI + Dokumentation

### Platzierung
**Neuer Tab `vault`** in `WorkspaceProjectPage.tsx`.  
**Neue Doku-Seite** in `dashboard/frontend/src/content/docs/`.

### Konzept

pgsodium / pg_vault ist in Supabase-Postgres bereits enthalten. Die Tabelle `vault.secrets`
existiert in jeder Instanz. Das UI erlaubt CRUD auf dieser Tabelle via SQL-Execution.

**SQL-Operationen:**
```sql
-- List secrets (Namen, nicht Werte)
SELECT id, name, description, created_at, updated_at FROM vault.secrets;

-- Add secret
SELECT vault.create_secret('my-api-key', 'secret-value', 'Description');

-- Read secret (decrypted)
SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'my-api-key';

-- Update secret
SELECT vault.update_secret(id, 'new-value') FROM vault.secrets WHERE name = 'my-api-key';

-- Delete secret
DELETE FROM vault.secrets WHERE id = '...';
```

### Frontend Tasks

**Neue Datei:** `dashboard/frontend/src/pages/workspace-tabs/VaultPanel.tsx`

```
Task FE-6.1: VaultPanel Komponente erstellen
  - Tabelle mit bekannten Secrets: name, description, updated_at
  - Werte werden NICHT in der Liste angezeigt (nur Namen — wie in Supabase)
  - "Add Secret" Button → Modal: Name, Description, Value (type=password)
  - Pro Zeile:
    - "Reveal" Button → Wert einmalig anzeigen (maskiert danach wieder)
    - "Edit" Button → Wert aktualisieren Modal
    - "Delete" Button mit Confirm-Dialog
  - Leer-State: "No secrets yet. Add your first secret."
  - Hinweis-Banner: "Values are stored encrypted via pgsodium. Never logged."
```

**Datei:** `dashboard/frontend/src/pages/WorkspaceProjectPage.tsx`

```
Task FE-6.2: Vault-Tab zur Sidebar hinzufügen
  - Tab-Eintrag: 'vault' mit KeyRound-Icon (Lucide)
  - Import: VaultPanel
  - Render-Case hinzufügen
```

**Datei:** `dashboard/frontend/src/lib/api.ts`

```
Task FE-6.3: vaultApi Namespace
  - vaultApi.list(instanceName)     → GET /api/instances/:name/vault
  - vaultApi.add(instanceName, name, value, description)  → POST
  - vaultApi.reveal(instanceName, id)    → GET /api/instances/:name/vault/:id/reveal
  - vaultApi.update(instanceName, id, value) → PATCH
  - vaultApi.remove(instanceName, id)   → DELETE
```

### Backend Tasks

**Neue Datei:** `dashboard/backend/src/routes/vault.ts`

```
Task BE-6.1: createVaultRoutes() implementieren
  GET    /api/instances/:name/vault         → SQL: SELECT id, name, description, created_at FROM vault.secrets
  POST   /api/instances/:name/vault         → SQL: SELECT vault.create_secret(name, value, description)
  GET    /api/instances/:name/vault/:id/reveal  → SQL: SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = ?
  PATCH  /api/instances/:name/vault/:id     → SQL: SELECT vault.update_secret(id, newValue)
  DELETE /api/instances/:name/vault/:id     → SQL: DELETE FROM vault.secrets WHERE id = ?

  Alle Routen: requireAuth
  SQL-Execution via: instanceManager.executeSQL(name, sql)
  Parameter-Binding: SQL-Injection Prevention via parametrisierte Queries!
  return res.json(...) pattern
```

**Datei:** `dashboard/backend/src/server.ts`

```
Task BE-6.2: Vault-Route registrieren
  import { createVaultRoutes } from './routes/vault'
  app.use('/api/instances/:name/vault', requireAuth, createVaultRoutes(instanceManager))
```

### Dokumentation

**Neue Datei:** `dashboard/frontend/src/content/docs/vault/secrets.md`

```
Task DOCS-6.1: Vault/Secrets Doku-Seite erstellen
  Inhalt:
  - Was ist pg_vault / pgsodium?
  - Wie funktioniert die Verschlüsselung (AES-256-GCM)
  - Best Practices: Secret-Namen, Rotation
  - Wie greift die App auf Secrets zu (SQL + RLS)
  - Beispiel: Edge Function die Vault-Secret liest
```

---

## Feature 7 — Network Restrictions (IP-Whitelist + SSL-Enforcement)

### Platzierung
**Neuer Tab `security`** in `WorkspaceProjectPage.tsx`.

### Konzept

Zwei Bereiche:

**SSL Enforcement:**  
GoTrue kann so konfiguriert werden, dass nur HTTPS-Connections erlaubt sind.
PostgREST kann `PGRST_DB_PRE_REQUEST` nutzen um Verbindungen zu validieren.
Einfacher Ansatz: ENV-Toggle der HTTPS-Redirect in der Nginx-Config aktiviert.

**IP-Whitelist:**  
Nginx `allow`/`deny` Regeln pro Instanz im Gateway-Template. Nur konfigurierte IPs
dürfen auf die API-Endpunkte zugreifen. Nützlich für interne APIs.

**ENV-Variablen:**
```
SECURITY_IP_WHITELIST        # Komma-separierte IP-Liste: "1.2.3.4,5.6.7.8/24"
SECURITY_SSL_ONLY            # true/false
SECURITY_RATE_LIMIT_RPM      # Rate limit pro Minute pro IP (Nginx limit_req)
```

### Frontend Tasks

**Neue Datei:** `dashboard/frontend/src/pages/workspace-tabs/SecurityPanel.tsx`

```
Task FE-7.1: SecurityPanel Komponente erstellen

  Section 1: SSL Enforcement
    - Toggle: "Enforce HTTPS-only access"
    - Beschreibung: "Redirects all HTTP requests to HTTPS. Requires a valid SSL certificate."
    - ENV: SECURITY_SSL_ONLY

  Section 2: IP Restrictions
    - Toggle: "Enable IP Whitelist"  
    - Wenn aktiv: Textarea für IP-Liste (eine pro Zeile, CIDR-Notation erlaubt)
    - Vorschau: zeigt aktive Allow/Deny Regeln
    - ENV: SECURITY_IP_WHITELIST
    - Warnung-Banner wenn Whitelist aktiviert: "Ensure your IP is in the list before saving!"

  Section 3: Rate Limiting
    - Toggle: "Enable API Rate Limiting"
    - Slider/Input: Requests per Minute (10–1000, Default 300)
    - ENV: SECURITY_RATE_LIMIT_RPM

  Save-Button → PATCH /api/instances/:name/security
```

**Datei:** `dashboard/frontend/src/pages/WorkspaceProjectPage.tsx`

```
Task FE-7.2: Security-Tab zur Sidebar hinzufügen
  - Tab-Eintrag: 'security' mit ShieldCheck-Icon (Lucide)
  - Import: SecurityPanel
  - Render-Case hinzufügen
```

**Datei:** `dashboard/frontend/src/lib/api.ts`

```
Task FE-7.3: securityApi Namespace
  - securityApi.get(instanceName)
  - securityApi.update(instanceName, config: { sslOnly, ipWhitelist, rateLimitRpm })
```

### Backend Tasks

**Neue Datei:** `dashboard/backend/src/routes/security.ts`

```
Task BE-7.1: createSecurityRoutes() implementieren
  GET  /api/instances/:name/security  → liest SECURITY_* ENV-Vars der Instanz
  PATCH /api/instances/:name/security → schreibt SECURITY_* ENV-Vars + triggert
    NginxGatewayGenerator.regenerateTenantConfig() + reloadNginxGateway()
  return res.json(...) pattern
```

**Datei:** `dashboard/backend/src/services/NginxGatewayGenerator.ts`

```
Task BE-7.2: IP-Whitelist + Rate-Limit in Gateway-Template integrieren
  - generateNginxGatewayConfig() erhält neue Parameter:
    ipWhitelist?: string[]   → erzeugt nginx allow/deny Direktiven
    rateLimitRpm?: number    → erzeugt nginx limit_req_zone + limit_req
  - SSL-Enforcement: HTTP → HTTPS Redirect wenn SECURITY_SSL_ONLY=true

Task BE-7.3: Security-Route in server.ts registrieren
  app.use('/api/instances/:name/security', createSecurityRoutes(instanceManager))
```

---

## Datei-Übersicht: Was wird angelegt / geändert

### Neue Dateien

| Datei | Beschreibung |
|-------|-------------|
| `dashboard/frontend/src/pages/workspace-tabs/DomainsPanel.tsx` | Custom Domains UI |
| `dashboard/frontend/src/pages/workspace-tabs/VaultPanel.tsx` | Vault Secrets UI |
| `dashboard/frontend/src/pages/workspace-tabs/SecurityPanel.tsx` | Network Security UI |
| `dashboard/frontend/src/pages/workspace-tabs/StorageCachePanel.tsx` | Storage CDN Settings |
| `dashboard/frontend/src/content/docs/vault/secrets.md` | Vault Dokumentation |
| `dashboard/backend/src/services/CustomDomainService.ts` | Custom Domain Backend-Logik |
| `dashboard/backend/src/routes/domains.ts` | Custom Domains API-Routes |
| `dashboard/backend/src/routes/vault.ts` | Vault API-Routes |
| `dashboard/backend/src/routes/security.ts` | Security API-Routes |

### Geänderte Dateien

| Datei | Änderung |
|-------|---------|
| `dashboard/frontend/src/pages/WorkspaceProjectPage.tsx` | 4 neue Tabs: auth, vault, domains, security |
| `dashboard/frontend/src/pages/InstanceDetail.tsx` | Auth-Tab entfernen |
| `dashboard/frontend/src/components/AuthTab.tsx` | Phone Config, CAPTCHA, SAML SSO, HTML Templates |
| `dashboard/frontend/src/components/StorageTab.tsx` | Tus Upload + CDN-Toggle |
| `dashboard/frontend/src/pages/WorkspaceProjectsPage.tsx` | Environment-Labels + Clone-Shortcuts |
| `dashboard/frontend/src/lib/api.ts` | domainsApi, vaultApi, securityApi, environmentApi |
| `dashboard/backend/src/server.ts` | 3 neue Route-Registrierungen |
| `dashboard/backend/src/services/NginxGatewayGenerator.ts` | CDN Cache + IP-Whitelist + Rate-Limit |
| `dashboard/backend/src/services/InstanceManager.ts` | environment-Feld in getInstances() |
| `dashboard/backend/src/routes/instances.ts` | PATCH /environment Endpoint |
| `dashboard/backend/prisma/schema.prisma` | CustomDomain Model + environment-Feld |

---

## Implementierungs-Reihenfolge

### Sprint 1 — Quick Wins (1–2 Tage)
1. **Feature 1** — Auth-Tab in Workspace einbinden + aus InstanceDetail entfernen
2. **Feature 4** — Environment-Labels + Clone-Shortcuts (DB-Feld + Badge + Menü)
3. **Feature 6** — Vault UI (nutzt existierende SQL-Execution, minimaler Aufwand)

### Sprint 2 — Auth-Erweiterungen (1–2 Tage)
4. **Feature 2a** — Phone Login Provider Config (Twilio/MessageBird/Vonage)
5. **Feature 2b** — Magic Link HTML Template Bodies
6. **Feature 2c** — CAPTCHA Integration
7. **Feature 2d** — SAML SSO Section

### Sprint 3 — Storage & Security (1–2 Tage)
8. **Feature 7** — Network Restrictions (Security-Tab)
9. **Feature 5b** — Nginx CDN Cache-Headers
10. **Feature 5a** — Tus Resumable Uploads

### Sprint 4 — Custom Domains (2–3 Tage)
11. **Feature 3** — Custom Domains inkl. Prisma Migration, DNS-Check, Certbot

---

## Wichtige Code-Konventionen

### Backend (TypeScript)
- `tsconfig` hat `"noImplicitReturns": true` → **immer** `return res.json(...)` statt `res.json(...)`
- SQL-Injection Prevention bei Vault-Routes: Parameter niemals direkt in SQL-String
- `requireAuth` Middleware auf alle neuen Routes

### Frontend (React/TypeScript)
- CSS-Klassen: `glass-card`, `bg-white/5`, `border-white/10`, `text-brand-400`, `bg-brand-500/15`
- Icons: Lucide React
- Toasts: `toast.success()` / `toast.error()` via Sonner
- Data-Fetching: `@tanstack/react-query` mit `useQuery` / `useMutation`
- Tabs in WorkspaceProjectPage: Value `string` → URL-Segment

### Vault SQL Security
```typescript
// FALSCH — SQL Injection möglich:
const sql = `SELECT vault.create_secret('${name}', '${value}', '${desc}')`;

// RICHTIG — Parameter binding über executeSQL mit escaped values:
const sql = `SELECT vault.create_secret(
  ${JSON.stringify(name)},
  ${JSON.stringify(value)},
  ${JSON.stringify(description)}
)`;
// Oder besser: Backend verwendet pg-Parameterized Queries direkt
```

---

## Impact-Zusammenfassung

| Feature | Self-Hosting Relevanz | Aufwand gesamt |
|---------|----------------------|----------------|
| Auth-Tab verschieben | Hoch (UX) | Klein |
| Auth-Erweiterungen | Hoch (Twilio/CAPTCHA/SAML) | Mittel |
| Custom Domains | Hoch (Agenturen/White-Label) | Mittel |
| Environment-Labels | Mittel (Übersicht bei vielen Projekten) | Klein |
| Tus Uploads | Mittel (große Dateien) | Mittel |
| Nginx CDN Cache | Mittel (Performance) | Klein |
| Vault UI | Mittel (Secrets-Verwaltung) | Klein |
| Network Restrictions | Hoch (Security-Compliance) | Klein |
