# Multibase – Linux Production Readiness Plan

**Erstellt:** 25. Februar 2026  
**Branch:** `cloud-version`  
**Ziel:** Alle identifizierten Probleme beheben, bevor der Branch in `main` gemergt wird und auf einer Linux-Produktionsmaschine deployed werden kann.

---

## Hintergrund

Der `cloud-version`-Branch beinhaltet eine vollständige Architektur-Überarbeitung von Multibase:

- **Shared Infrastructure**: Ein einziger PostgreSQL-, Studio-, Analytics-, Vector-, imgproxy-, Meta-, Pooler- und Nginx-Gateway-Stack für alle Tenants
- **Lightweight Tenants**: Statt 13 Container pro Tenant nur noch 5 (Auth, REST, Realtime, Storage, Functions)
- **Nginx-Gateway statt Kong**: Ein gemeinsamer `nginx:alpine` Container (~20 MB) ersetzt N Kong-Container (~1.7 GiB/Stück)

Der Stack wurde lokal unter Windows/Docker Desktop vollständig validiert. Für die Linux-Produktionsumgebung wurden bei der Code-Analyse folgende kritische Probleme identifiziert, die **vor dem Merge** behoben werden müssen.

---

## Identifizierte Probleme (Übersicht)

| # | Priorität | Problem | Datei(en) | Aufwand |
|---|---|---|---|---|
| 1 | 🔴 KRITISCH | Hardcodierte Domain `backend.tyto-design.de` in Nginx-Config-Generierung | `InstanceManager.ts` | 5 min |
| 2 | 🔴 KRITISCH | Hardcodierte E-Mail `notification@tyto-design.de` bei Certbot | `InstanceManager.ts` | 5 min |
| 3 | 🔴 KRITISCH | Docker Ports ohne `127.0.0.1`-Binding → PostgreSQL von Internet erreichbar | `docker-compose.shared.yml` | 10 min |
| 4 | 🔴 KRITISCH | Shared Stack-Init fehlt komplett im Installer | `deployment/install.sh` | 45 min |
| 5 | 🔴 KRITISCH | Backend `.env` fehlen 6 kritische Variablen im Installer | `deployment/install.sh` | 20 min |
| 6 | 🔴 KRITISCH | `sudo nginx -s reload` + `sudo certbot` schlagen lautlos fehl (fehlende sudoers) | `deployment/install.sh` | 15 min |
| 7 | 🔴 KRITISCH | Port-Limit: nginx-gateway kann nur 5 Tenants bedienen (hardcodiert) | `docker-compose.shared.yml`, `setup_shared.py` | 1–2 h |
| 8 | 🟡 MITTEL | Wildcard-SSL-Option fehlt im Installer-Wizard (Let's Encrypt Rate-Limit) | `deployment/install.sh` | 30 min |
| 9 | 🟡 MITTEL | Kein Auto-Start des Shared Stacks nach Server-Reboot | `deployment/install.sh` | 20 min |
| 10 | 🟡 MITTEL | `DOCKER_HOST` vs. `DOCKER_SOCKET_PATH` Variablenname-Mismatch | `deployment/install.sh`, `server.ts` | 5 min |

---

## Phase 1 — Schnelle Code-Fixes (~30 min)

### Step 1: `InstanceManager.ts` — Hardcodierte Domain entfernen

**Datei:** `dashboard/backend/src/services/InstanceManager.ts`

**Problem:**  
In der Methode `createNginxConfig()` ist die Domain fest eincodiert:

```typescript
// AKTUELL (falsch):
const domain = 'backend.tyto-design.de';
const dashboardUrl = process.env.DASHBOARD_URL || 'https://multibase.tyto-design.de';
const backendUrl   = process.env.BACKEND_URL   || 'https://backend.tyto-design.de';
```

`domain` hat keinen `process.env`-Fallback. Jede automatisch generierte Nginx-Config eines neuen Tenants zeigt auf eine fremde Domain. Auf jedem anderen Server als dem eigenen ist dies sofort kaputt.

**Fix:**
```typescript
const domain      = process.env.BACKEND_DOMAIN  || 'backend.tyto-design.de';
const dashboardUrl = process.env.DASHBOARD_URL  || `https://${process.env.FRONTEND_DOMAIN || 'multibase.tyto-design.de'}`;
const backendUrl   = process.env.BACKEND_URL    || `https://${domain}`;
```

---

### Step 2: `InstanceManager.ts` — Hardcodierte Certbot-E-Mail entfernen

**Datei:** `dashboard/backend/src/services/InstanceManager.ts`

**Problem:**  
Certbot wird mit einer fest eincodierten E-Mail-Adresse aufgerufen:

```typescript
// AKTUELL (falsch):
const email = 'notification@tyto-design.de';
await execAsync(
  `sudo certbot --nginx -d ${studioDomain} -d ${apiDomain} --non-interactive --agree-tos --redirect --email ${email}`
);
```

SSL-Zertifikate werden auf eine private E-Mail ausgestellt. Der Installer can keine Benachrichtigungen über ablaufende Zertifikate an den richtigen Empfänger senden.

**Fix:**
```typescript
const email = process.env.SSL_EMAIL || process.env.CERTBOT_EMAIL || process.env.ADMIN_EMAIL || '';
if (!email) {
  logger.warn('SSL_EMAIL not set — Certbot skipped');
  return;
}
```

---

### Step 3: `docker-compose.shared.yml` — Port-Binding auf `127.0.0.1`

**Datei:** `shared/docker-compose.shared.yml`

**Problem:**  
Auf Linux umgeht Docker UFW-Firewall-Regeln direkt via `iptables`. Alle Ports die in `docker-compose` mit `PORT:PORT` veröffentlicht sind, sind von **außen über das Internet erreichbar** — egal was UFW konfiguriert ist.

Aktuell betroffen (direkt aus dem Internet erreichbar bei Linux-Deployment):
- `:5432` — **PostgreSQL** (Passwörter können gebrute-forced werden!)
- `:3000` — Supabase Studio
- `:4000` — Analytics/Logflare
- `:6543` — Supabase Pooler
- `:8000` — Nginx-Gateway (hier ist es OK, oder soll über Host-Nginx gerouted werden)
- `:4928`, `:4351`, `:4681`, `:4100`, `:4200` — Tenant-Ports

**Fix — Alle Ports auf localhost binden:**
```yaml
# VORHER:
ports:
  - "${SHARED_PG_PORT:-5432}:5432"

# NACHHER:
ports:
  - "127.0.0.1:${SHARED_PG_PORT:-5432}:5432"
```

> **Ausnahme:** Die UFW-Frage ist damit irrelevant — Docker kann gar nicht mehr direkt von außen angesprochen werden. Der ganze Traffic läuft über den Host-Nginx (Port 80/443), der die Requests intern weiterleitet.

---

## Phase 2 — `install.sh` erweitern (~2 h)

### Step 4: Backend `.env` — fehlende Variablen ergänzen

**Datei:** `deployment/install.sh`, Funktion `generate_configs()`

**Problem:**  
Das Backend `.env` wird vom Installer generiert, aber 6 Variablen fehlen, die der Code erwartet:

| Variable | Erwartet von | Aktuell |
|---|---|---|
| `BACKEND_DOMAIN` | `InstanceManager.ts` (Nginx-Config) | ❌ fehlt |
| `FRONTEND_DOMAIN` | `InstanceManager.ts` (Dashboard-URL) | ❌ fehlt |
| `DASHBOARD_URL` | `InstanceManager.ts` (Login-Redirects) | ❌ fehlt |
| `BACKEND_URL` | `InstanceManager.ts` (Auth-Subrequest) | ❌ fehlt |
| `DOCKER_SOCKET_PATH` | `server.ts` liest diese Variable | ❌ fehlt (Installer schreibt `DOCKER_HOST`) |
| `SSL_EMAIL` / `CERTBOT_EMAIL` | `InstanceManager.ts` (Certbot) | ❌ fehlt |
| `SHARED_DIR` | Zukünftige Referenz | ❌ fehlt |

**Fix — Ergänzung in `generate_configs()`:**
```bash
cat > "$INSTALL_DIR/dashboard/backend/.env" <<EOF
# ── Server ──────────────────────────────
PORT=3001
NODE_ENV=production

# ── Datenbank & Cache ────────────────────
DATABASE_URL="file:./data/multibase.db"
REDIS_URL=redis://localhost:6379

# ── Docker ───────────────────────────────
DOCKER_SOCKET_PATH=/var/run/docker.sock

# ── Pfade ────────────────────────────────
PROJECTS_PATH=${INSTALL_DIR}/projects
PYTHON_PATH=${INSTALL_DIR}/venv/bin/python3
BACKUP_PATH=${INSTALL_DIR}/backups
SHARED_DIR=${INSTALL_DIR}/shared

# ── Domains (NEU) ────────────────────────
BACKEND_DOMAIN=${BACKEND_DOMAIN}
FRONTEND_DOMAIN=${FRONTEND_DOMAIN}
DASHBOARD_URL=https://${FRONTEND_DOMAIN}
BACKEND_URL=https://${BACKEND_DOMAIN}

# ── SSL (NEU) ────────────────────────────
SSL_EMAIL=${SSL_EMAIL}
CERTBOT_EMAIL=${SSL_EMAIL}

# ── CORS ─────────────────────────────────
CORS_ORIGIN=${FRONTEND_URL}

# ── Logging & Monitoring ──────────────────
LOG_LEVEL=info
METRICS_INTERVAL=15000
HEALTH_CHECK_INTERVAL=10000
ALERT_CHECK_INTERVAL=60000

# ── Session ──────────────────────────────
SESSION_SECRET=${session_secret}
EOF
```

---

### Step 5: Shared Stack-Init im Installer

**Datei:** `deployment/install.sh`

**Problem:**  
Der Installer klont das Repository und baut Backend/Frontend, aber startet die Shared Infrastructure (Kern des neuen Cloud-Stacks) überhaupt nicht:
- `python setup_shared.py init` wird nie aufgerufen → keine `.env.shared` → keine Secrets
- `docker-compose.shared.yml` wird nie gestartet → kein PostgreSQL, kein Studio, kein Nginx-Gateway

**Neue Funktion `setup_shared_infra()`:**
```bash
setup_shared_infra() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Setting up Shared Infrastructure..."

    local shared_dir="$INSTALL_DIR/shared"
    local python="$INSTALL_DIR/venv/bin/python3"

    # 1. Secrets + .env.shared generieren (nur wenn noch nicht vorhanden)
    if [ ! -f "$shared_dir/.env.shared" ]; then
        sudo -u "$INSTALL_USER" "$python" "$INSTALL_DIR/setup_shared.py" init
        step_new ".env.shared generated with secure secrets"
    else
        step_ok ".env.shared already exists"
    fi

    # 2. Update SHARED_PUBLIC_URL basierend auf der konfigurierten Backend-Domain
    sed -i "s|SHARED_PUBLIC_URL=.*|SHARED_PUBLIC_URL=https://${BACKEND_DOMAIN}|" \
        "$shared_dir/.env.shared"

    # 3. Shared Stack starten
    sudo -u "$INSTALL_USER" "$python" "$INSTALL_DIR/setup_shared.py" start
    step_ok "Shared stack started (PostgreSQL, Studio, Nginx-Gateway, Analytics, ...)"

    # 4. Warten bis PostgreSQL bereit ist (max. 60 Sekunden)
    step "Waiting for PostgreSQL to be ready..."
    local retries=0
    until docker exec multibase-db pg_isready -U postgres -q 2>/dev/null; do
        retries=$((retries + 1))
        if [ "$retries" -ge 60 ]; then
            step_fail "PostgreSQL did not become ready in 60 seconds"
            error_exit "Shared PostgreSQL failed to start"
        fi
        sleep 1
    done
    step_ok "PostgreSQL is ready"

    # 5. Nginx-Tenant-Configs für eventuelle bestehende Projekte regenerieren
    sudo -u "$INSTALL_USER" "$python" -c "
from setup_shared import SharedInfraManager
m = SharedInfraManager()
m._regenerate_nginx_tenant_configs()
"
    step_ok "Nginx gateway configs regenerated"
}
```

Aufruf in `main()` nach `build_backend`:
```bash
build_backend
setup_shared_infra    # ← NEU
build_frontend
```

---

### Step 6: sudoers-Eintrag für `nginx` und `certbot`

**Datei:** `deployment/install.sh`

**Problem:**  
Das Backend läuft als `multibase`-Systembenutzer via PM2. Wenn eine neue Instanz erstellt wird, führt `InstanceManager.ts` folgende Befehle aus:

```typescript
await execAsync('sudo nginx -s reload');
await execAsync(`sudo certbot --nginx -d ${domain} ...`);
```

Ohne einen `sudoers`-Eintrag schlägt beides **lautlos fehl** (`Permission denied`). Der Code fängt den Fehler zwar ab (`do not throw`), aber Nginx-Configs werden nicht aktiviert und SSL nicht ausgestellt.

**Fix — Neue Funktion `setup_sudoers()`:**
```bash
setup_sudoers() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Configuring sudoers for nginx and certbot..."

    cat > /etc/sudoers.d/multibase <<EOF
# Multibase: allow backend service to reload nginx and run certbot
${INSTALL_USER} ALL=(ALL) NOPASSWD: /usr/sbin/nginx -s reload
${INSTALL_USER} ALL=(ALL) NOPASSWD: /usr/bin/certbot *
${INSTALL_USER} ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
EOF
    chmod 440 /etc/sudoers.d/multibase
    visudo -c -f /etc/sudoers.d/multibase >> "$LOG_FILE" 2>&1
    step_ok "sudoers configured for ${INSTALL_USER}"
}
```

Aufruf in `main()` nach `setup_user_dirs`.

---

## Phase 3 — Port-Skalierung des Nginx-Gateways (~1–2 h)

### Step 7: Mehr als 5 Tenants ermöglichen

**Dateien:** `shared/docker-compose.shared.yml`, `setup_shared.py`

**Problem:**  
Der `nginx-gateway`-Container hat aktuell 5 fest verdrahtete Port-Mappings:

```yaml
ports:
  - "${NGINX_PORT_1:-4928}:${NGINX_PORT_1:-4928}/tcp"  # Tenant 1
  - "${NGINX_PORT_2:-4351}:${NGINX_PORT_2:-4351}/tcp"  # Tenant 2
  - "${NGINX_PORT_3:-4681}:${NGINX_PORT_3:-4681}/tcp"  # Tenant 3
  - "${NGINX_PORT_4:-4100}:${NGINX_PORT_4:-4100}/tcp"  # Tenant 4
  - "${NGINX_PORT_5:-4200}:${NGINX_PORT_5:-4200}/tcp"  # Tenant 5
```

Auf Windows/Docker Desktop ist Docker in einer VM — dort funktioniert der interne Nginx-Gateway-Port auch ohne explizites Mapping. Auf Linux läuft Docker **nativ**: Port-Forwarding vom Host in das Container-Netzwerk funktioniert nur für explizit gemappte Ports. Ab Tenant 6 können keine neuen Ports auf `127.0.0.1` gemappt werden.

**Gewählte Lösung: `docker-compose.override.yml` dynamisch generieren**

Beim Erstellen eines neuen Tenants wird `supabase_manager.py` erweitert:

1. Den zugewiesenen Gateway-Port des neuen Tenants in `.env.shared` unter `NGINX_PORT_N` eintragen
2. Ein `shared/docker-compose.override.yml` mit allen aktuellen Tenant-Ports generieren
3. Den Shared Stack kurz neu starten (`docker compose up -d --no-recreate` — nur neue Ports werden hinzugefügt)

**Neue Hilfsfunktion in `setup_shared.py`:**
```python
def add_tenant_port(self, gateway_port: int) -> bool:
    """Register a new tenant port in .env.shared and regenerate override."""
    env = self._get_shared_env()

    # Find all existing NGINX_PORT_N entries
    existing_ports = []
    i = 1
    while f'NGINX_PORT_{i}' in env:
        existing_ports.append(int(env[f'NGINX_PORT_{i}']))
        i += 1

    if gateway_port in existing_ports:
        return False  # Port bereits registriert

    # Add new port to .env.shared
    new_index = len(existing_ports) + 1
    with open(self.env_file, 'a') as f:
        f.write(f'\nNGINX_PORT_{new_index}={gateway_port}\n')

    # Regenerate docker-compose.override.yml
    self._write_compose_override(existing_ports + [gateway_port])

    # Apply new port mapping (recreates only nginx-gateway)
    subprocess.run([
        'docker', 'compose',
        '-f', str(self.compose_file),
        '-f', str(self.shared_dir / 'docker-compose.override.yml'),
        '--env-file', str(self.env_file),
        'up', '-d', 'nginx-gateway'
    ], cwd=str(self.shared_dir))
    return True

def _write_compose_override(self, ports: list[int]):
    """Write docker-compose.override.yml with current port list."""
    port_lines = '\n'.join(
        f'      - "127.0.0.1:{p}:{p}/tcp"' for p in ports
    )
    content = f"""# Auto-generated by setup_shared.py – DO NOT EDIT MANUALLY
# Regenerated on: {time.strftime('%Y-%m-%d %H:%M:%S')}
services:
  nginx-gateway:
    ports:
{port_lines}
"""
    override_path = self.shared_dir / 'docker-compose.override.yml'
    write_with_unix_newlines(str(override_path), content)
```

**Aufruf in `supabase_setup.py`**, nach erfolgreicher Nginx-Config-Generierung:
```python
# Register tenant port with shared stack
manager = SharedInfraManager()
manager.add_tenant_port(self.ports['gateway_port'])
```

---

## Phase 4 — SSL-Strategie (~30 min)

### Step 8: Wildcard-SSL Option im Wizard

**Datei:** `deployment/install.sh`

**Problem:**  
Let's Encrypt erlaubt maximal **50 Zertifikate pro registrierter Domain pro Woche** (Rate Limit). Da der aktuelle Code für jeden neuen Tenant automatisch `certbot` aufruft (je 2 Domains: Studio + API), ist das Limit bei 25 Tenants pro Woche erreicht.

Bessere Alternative: Einmalig ein Wildcard-Zertifikat für `*.BACKEND_DOMAIN` ausstellen.

**Wizard-Erweiterung:**
```bash
wizard_ssl() {
    # ... bestehender Code ...

    if [ "$SSL_ENABLED" = "y" ]; then
        echo ""
        echo "  SSL Certificate Type:"
        echo -e "  ${BOLD}[1]${NC} Per-subdomain  ${DIM}(auto-issued per tenant, max 50/week)${NC}"
        echo -e "  ${BOLD}[2]${NC} Wildcard       ${DIM}(*.${BACKEND_DOMAIN}, DNS challenge required, no rate limit)${NC}"
        local ssl_type=""
        prompt ssl_type "Certificate type" "1"

        if [ "$ssl_type" = "2" ]; then
            SSL_TYPE="wildcard"
            echo ""
            echo -e "  ${YELLOW}Wildcard SSL requires DNS TXT record validation.${NC}"
            echo -e "  ${DIM}You will need to manually add a DNS TXT record during setup.${NC}"
        else
            SSL_TYPE="per-tenant"
        fi
    fi
}
```

Beim Wildcard-Flow: einmalig `certbot certonly --manual --preferred-challenges dns` für `*.BACKEND_DOMAIN` + `BACKEND_DOMAIN`. Das resultierende Zertifikat deckt alle Tenant-Subdomains ab.

---

## Phase 5 — Auto-Start nach Reboot (~20 min)

### Step 9: Systemd-Unit für Shared Stack

**Datei:** `deployment/install.sh`

**Problem:**  
PM2 wird für das Node.js-Backend eingerichtet (`pm2 startup`). Aber der Shared Docker Stack (`docker-compose.shared.yml`) hat kein Startup-Management. After einem Server-Reboot läuft Docker zwar, aber die Shared-Container müssen manuell mit `python setup_shared.py start` gestartet werden.

Docker's eigenes `restart: unless-stopped` greift nur, wenn der Container bereits mindestens einmal gestartet wurde und Docker selbst neu startet — aber nicht nach einem sauberen `docker compose down`.

**Fix — Systemd-Unit generieren:**
```bash
setup_shared_autostart() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Configuring Shared Infrastructure auto-start..."

    cat > /etc/systemd/system/multibase-shared.service <<EOF
[Unit]
Description=Multibase Shared Infrastructure (Docker Compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
User=${INSTALL_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/python3 ${INSTALL_DIR}/setup_shared.py start
ExecStop=/usr/bin/docker compose -f ${INSTALL_DIR}/shared/docker-compose.shared.yml \
    --env-file ${INSTALL_DIR}/shared/.env.shared down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable multibase-shared.service
    step_ok "Shared Infrastructure configured for auto-start on boot"
}
```

**PM2-Abhängigkeit sicherstellen** — PM2-Backend erst starten, wenn Shared Stack läuft:
```javascript
// ecosystem.config.js – ergänzen:
module.exports = {
  apps: [{
    name: 'multibase-backend',
    // ...
    wait_ready: true,
    listen_timeout: 30000,
  }]
};
```

---

### Step 10: `DOCKER_HOST` vs. `DOCKER_SOCKET_PATH` Mismatch

**Datei:** `deployment/install.sh`, `dashboard/backend/src/server.ts`

**Problem:**  
Das `install.sh` schreibt `DOCKER_HOST=/var/run/docker.sock` ins Backend `.env`.  
`server.ts` liest aber `process.env.DOCKER_SOCKET_PATH`:

```typescript
// server.ts
const DOCKER_SOCKET_PATH = process.env.DOCKER_SOCKET_PATH;
const dockerManager = new DockerManager(DOCKER_SOCKET_PATH);
```

Resultat: `DOCKER_SOCKET_PATH` ist `undefined`, `DockerManager` wird ohne expliziten Socket-Pfad initialisiert. Das klappt oft trotzdem (Docker-Default), ist aber fehleranfällig auf Systemen mit non-standard Socket-Pfaden.

**Fix:** Im Installer `DOCKER_SOCKET_PATH` statt `DOCKER_HOST` schreiben (vgl. Step 4).

---

## Abarbeitungs-Reihenfolge (empfohlen)

```
Step 1  ── InstanceManager.ts: env-Vars für Domain/Email         ~5 min
Step 2  ── InstanceManager.ts: SSL-Email Fallback + Guard        ~5 min
Step 3  ── docker-compose.shared.yml: 127.0.0.1 Port-Binding    ~10 min
        └─ COMMIT: "fix: Hardcoded domain/email + Docker port binding"

Step 4  ── install.sh: Backend .env fehlende Variablen           ~20 min
Step 5  ── install.sh: setup_shared_infra() Funktion             ~45 min
Step 6  ── install.sh: setup_sudoers() Funktion                  ~15 min
Step 10 ── install.sh: DOCKER_HOST → DOCKER_SOCKET_PATH          ~5 min
        └─ COMMIT: "feat(installer): Shared Stack init + sudoers + env fixes"

Step 7  ── Port-Skalierung: dynamic override in setup_shared.py  ~90 min
        └─ COMMIT: "feat: Dynamic nginx-gateway port scaling"

Step 9  ── install.sh: Systemd-Unit für Shared Stack             ~20 min
        └─ COMMIT: "feat(installer): Shared Stack systemd auto-start"

Step 8  ── install.sh: Wildcard-SSL Wizard-Option                ~30 min
        └─ COMMIT: "feat(installer): Wildcard SSL option"

Final   ── INSTALL.md aktualisieren
        ── TESTING auf frischer Ubuntu 22.04 VM
        └─ PR: cloud-version → main
```

---

## Test-Checkliste (vor dem Merge)

### Auf frischer Ubuntu 22.04 VM testen:

- [ ] `curl -sSL .../install.sh | sudo bash` läuft ohne Fehler durch
- [ ] PM2 `multibase-backend` startet und ist `online`
- [ ] Nginx läuft, SSL-Zertifikate vorhanden
- [ ] `multibase-shared.service` ist `active (running)`
- [ ] Nach VM-Reboot: Shared Stack und PM2-Backend starten automatisch
- [ ] `https://dashboard.example.com` → Dashboard-Login erreichbar
- [ ] Im Dashboard: Neue Cloud-Instanz erstellen
  - [ ] 5 Container starten (`docker ps`)
  - [ ] Nginx-Config in `/opt/multibase/nginx/sites-enabled/` angelegt
  - [ ] SSL-Zertifikat für Subdomain ausgestellt
  - [ ] `https://instanz.api.example.com/health` → `{"status":"ok"}`
  - [ ] Studio über `https://instanz.api.example.com` erreichbar
- [ ] PostgreSQL Port 5432 von extern **nicht** erreichbar (`nc -z SERVER_IP 5432` schlägt fehl)
- [ ] 6. Instanz erstellen → fehlerfrei (Port-Skalierung funktioniert)
- [ ] Nach `sudo reboot`: Alle Instanzen wieder up

---

## Dateien-Übersicht (alle betroffenen Dateien)

| Datei | Änderungstyp |
|---|---|
| `dashboard/backend/src/services/InstanceManager.ts` | Bugfix: env-Vars für Domain, Email |
| `shared/docker-compose.shared.yml` | Security: 127.0.0.1 Port-Binding |
| `deployment/install.sh` | Feature: Shared-Init, sudoers, env-Vars, systemd, Wildcard-SSL |
| `setup_shared.py` | Feature: `add_tenant_port()`, dynamisches Override |
| `supabase_setup.py` | Feature: `add_tenant_port()` aufrufen |
| `INSTALL.md` | Doku: Aktualisierung für neue Features |

---

*Dieser Plan wird nach Abschluss jedes Steps als abgehakt markiert und der Branch nach erfolgreicher Test-Checkliste in `main` gemergt.*
