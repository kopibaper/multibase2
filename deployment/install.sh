#!/bin/bash
# =============================================================================
# Multibase Dashboard - Automated Installer v2.0
# =============================================================================
# Usage:
#   curl -sSL https://raw.githubusercontent.com/skipper159/multibase2/main/deployment/install.sh | sudo bash
#   sudo bash install.sh              # Fresh install
#   sudo bash install.sh --update     # Update existing installation
#   sudo bash install.sh --uninstall  # Remove installation
#   sudo bash install.sh --uninstall --keep-data  # Remove but keep data
# =============================================================================

set -euo pipefail

# --- Configuration ---
INSTALL_DIR="/opt/multibase"
INSTALL_USER="multibase"
REPO_URL="https://github.com/skipper159/multibase2.git"
REPO_BRANCH="${REPO_BRANCH:-cloud-version}"
LOG_FILE="/var/log/multibase-install.log"
NODE_MAJOR=20
REDIS_CONTAINER="multibase-redis"
PM2_APP_NAME="multibase-backend"
SCRIPT_VERSION="2.0.0"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# --- State Variables (populated by wizard) ---
DEPLOY_MODE=""          # single, split-frontend, split-backend
FRONTEND_DOMAIN=""
BACKEND_DOMAIN=""
BACKEND_URL=""          # Full URL for split-frontend mode
FRONTEND_URL=""         # Full URL for split-backend mode
ADMIN_USER="admin"
ADMIN_EMAIL=""
ADMIN_PASS=""
SSL_ENABLED="y"
SSL_EMAIL=""
SSL_TYPE="per-tenant"
UFW_ENABLED="y"
SWAP_ENABLED="y"
TOTAL_STEPS=14
CURRENT_STEP=0

# =============================================================================
# Utility Functions
# =============================================================================

log() {
    echo -e "${DIM}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo ""
    echo -e "${CYAN}[${CURRENT_STEP}/${TOTAL_STEPS}]${NC} ${BOLD}$1${NC}"
    log "STEP ${CURRENT_STEP}/${TOTAL_STEPS}: $1"
}

step_ok() {
    echo -e "        ${GREEN}[OK]${NC} $1"
    log "  OK: $1"
}

step_new() {
    echo -e "        ${YELLOW}[NEW]${NC} $1"
    log "  NEW: $1"
}

step_skip() {
    echo -e "        ${DIM}[SKIP]${NC} $1"
    log "  SKIP: $1"
}

step_fail() {
    echo -e "        ${RED}[FAIL]${NC} $1"
    log "  FAIL: $1"
}

error_exit() {
    echo ""
    echo -e "${RED}ERROR: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

prompt() {
    local var_name="$1"
    local prompt_text="$2"
    local default="${3:-}"
    local value=""

    if [ -n "$default" ]; then
        echo -ne "  ${prompt_text} ${DIM}[${default}]${NC}: "
    else
        echo -ne "  ${prompt_text}: "
    fi

    read -r value
    value="${value:-$default}"
    eval "$var_name='$value'"
}

prompt_password() {
    local var_name="$1"
    local prompt_text="$2"
    local value=""

    echo -ne "  ${prompt_text} ${DIM}(Enter for auto-generated)${NC}: "
    read -rs value
    echo ""

    if [ -z "$value" ]; then
        value=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)
        echo -e "  ${DIM}Auto-generated password${NC}"
    fi
    eval "$var_name='$value'"
}

prompt_yn() {
    local var_name="$1"
    local prompt_text="$2"
    local default="${3:-y}"
    local value=""

    echo -ne "  ${prompt_text} (y/n) ${DIM}[${default}]${NC}: "
    read -r value
    value="${value:-$default}"
    value=$(echo "$value" | tr '[:upper:]' '[:lower:]')
    eval "$var_name='$value'"
}

separator() {
    echo -e "${DIM}------------------------------------------------------${NC}"
}

generate_secret() {
    openssl rand -base64 48 | tr -d '/+=' | head -c 64
}

# =============================================================================
# Pre-Flight Checks
# =============================================================================

preflight_checks() {
    # Must be root
    if [ "$(id -u)" -ne 0 ]; then
        error_exit "This script must be run as root (use sudo)"
    fi

    # Check OS
    if [ ! -f /etc/os-release ]; then
        error_exit "Cannot determine OS. This script supports Ubuntu/Debian."
    fi

    source /etc/os-release
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        echo -e "${YELLOW}WARNING: This script is designed for Ubuntu/Debian. Your OS: ${ID}${NC}"
        echo -ne "  Continue anyway? (y/n) [n]: "
        read -r cont
        if [ "$cont" != "y" ]; then
            exit 0
        fi
    fi

    # Check minimum RAM (1 GB)
    local total_ram
    total_ram=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$total_ram" -lt 1024 ]; then
        error_exit "Minimum 1 GB RAM required. Detected: ${total_ram} MB"
    fi

    # Check disk space (5 GB minimum)
    local free_disk
    free_disk=$(df -BG / | awk 'NR==2{print $4}' | tr -d 'G')
    if [ "$free_disk" -lt 5 ]; then
        error_exit "Minimum 5 GB free disk space required. Available: ${free_disk} GB"
    fi

    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "=== Multibase Installer v${SCRIPT_VERSION} - $(date) ===" > "$LOG_FILE"
}

# =============================================================================
# Banner
# =============================================================================

show_banner() {
    echo ""
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${BOLD}"
    echo "    __  __       _ _   _ _"
    echo "   |  \/  |_   _| | |_(_) |__   __ _ ___  ___"
    echo "   | |\/| | | | | | __| | '_ \ / _\` / __|/ _ \\"
    echo "   | |  | | |_| | | |_| | |_) | (_| \__ \  __/"
    echo "   |_|  |_|\__,_|_|\__|_|_.__/ \__,_|___/\___|"
    echo -e "${NC}"
    echo -e "   ${DIM}Dashboard Installer v${SCRIPT_VERSION}${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo ""
    echo -e "  Welcome! This script will set up Multibase"
    echo -e "  on your server."
    echo ""
    echo -ne "  Press ${BOLD}Enter${NC} to continue..."
    read -r
}

# =============================================================================
# Interactive Wizard
# =============================================================================

wizard_deployment_mode() {
    echo ""
    separator
    echo -e "  ${BOLD}STEP 1/6 -- Deployment Mode${NC}"
    separator
    echo ""
    echo "  How should Multibase be installed?"
    echo ""
    echo -e "  ${BOLD}[1]${NC} Single Server"
    echo -e "      ${DIM}Frontend + Backend on this server${NC}"
    echo ""
    echo -e "  ${BOLD}[2]${NC} Split VPS -- Frontend Only"
    echo -e "      ${DIM}Static frontend, backend runs elsewhere${NC}"
    echo ""
    echo -e "  ${BOLD}[3]${NC} Split VPS -- Backend Only"
    echo -e "      ${DIM}API + Docker, frontend runs elsewhere${NC}"
    echo ""

    local choice=""
    prompt choice "Choice" "1"

    case "$choice" in
        1) DEPLOY_MODE="single" ;;
        2) DEPLOY_MODE="split-frontend" ;;
        3) DEPLOY_MODE="split-backend" ;;
        *) DEPLOY_MODE="single" ;;
    esac
}

wizard_domains() {
    echo ""
    separator
    echo -e "  ${BOLD}STEP 2/6 -- Domains${NC}"
    separator
    echo ""

    case "$DEPLOY_MODE" in
        single)
            prompt FRONTEND_DOMAIN "Frontend domain (e.g. dashboard.example.com)" ""
            [ -z "$FRONTEND_DOMAIN" ] && error_exit "Frontend domain is required"
            echo ""
            prompt BACKEND_DOMAIN "Backend domain (e.g. api.example.com)" ""
            [ -z "$BACKEND_DOMAIN" ] && error_exit "Backend domain is required"
            BACKEND_URL="https://${BACKEND_DOMAIN}"
            FRONTEND_URL="https://${FRONTEND_DOMAIN}"
            ;;
        split-frontend)
            prompt FRONTEND_DOMAIN "Frontend domain (this server)" ""
            [ -z "$FRONTEND_DOMAIN" ] && error_exit "Frontend domain is required"
            echo ""
            prompt BACKEND_URL "Backend URL (remote server, incl. https://)" ""
            [ -z "$BACKEND_URL" ] && error_exit "Backend URL is required"
            # Extract domain from URL
            BACKEND_DOMAIN=$(echo "$BACKEND_URL" | sed 's|https\?://||' | sed 's|/.*||')
            FRONTEND_URL="https://${FRONTEND_DOMAIN}"
            ;;
        split-backend)
            prompt BACKEND_DOMAIN "Backend domain (this server)" ""
            [ -z "$BACKEND_DOMAIN" ] && error_exit "Backend domain is required"
            echo ""
            prompt FRONTEND_URL "Frontend URL (remote server, for CORS)" ""
            [ -z "$FRONTEND_URL" ] && error_exit "Frontend URL is required"
            BACKEND_URL="https://${BACKEND_DOMAIN}"
            # Extract domain from URL
            FRONTEND_DOMAIN=$(echo "$FRONTEND_URL" | sed 's|https\?://||' | sed 's|/.*||')
            ;;
    esac
}

wizard_admin() {
    # Skip for frontend-only installations
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    echo ""
    separator
    echo -e "  ${BOLD}STEP 3/6 -- Admin Account${NC}"
    separator
    echo ""

    prompt ADMIN_USER "Username" "admin"
    prompt ADMIN_EMAIL "Email" ""
    [ -z "$ADMIN_EMAIL" ] && error_exit "Admin email is required"
    prompt_password ADMIN_PASS "Password"
}

wizard_ssl() {
    echo ""
    separator
    echo -e "  ${BOLD}STEP 4/6 -- SSL Certificate${NC}"
    separator
    echo ""

    prompt_yn SSL_ENABLED "Set up SSL via Let's Encrypt?" "y"

    if [ "$SSL_ENABLED" = "y" ]; then
        prompt SSL_EMAIL "Email for Let's Encrypt" "${ADMIN_EMAIL:-}"
        [ -z "$SSL_EMAIL" ] && error_exit "SSL email is required"

        echo ""
        echo -e "  ${DIM}Wildcard certs (*.domain.com) cover all subdomains automatically${NC}"
        echo -e "  ${DIM}but require a manual DNS TXT record during issuance (DNS-01 challenge).${NC}"
        local _wildcard="n"
        prompt_yn _wildcard "Use wildcard certificate (*.domain.com)?" "n"
        [ "$_wildcard" = "y" ] && SSL_TYPE="wildcard" || SSL_TYPE="per-tenant"
    fi
}

wizard_extras() {
    echo ""
    separator
    echo -e "  ${BOLD}STEP 5/6 -- Additional Options${NC}"
    separator
    echo ""

    prompt_yn UFW_ENABLED "Configure UFW firewall?" "y"

    local total_ram
    total_ram=$(free -m | awk '/^Mem:/{print $2}')
    if [ "$total_ram" -lt 4096 ]; then
        local current_swap
        current_swap=$(free -m | awk '/^Swap:/{print $2}')
        if [ "$current_swap" -lt 512 ]; then
            prompt_yn SWAP_ENABLED "Create 2 GB swap file? (recommended, ${total_ram} MB RAM)" "y"
        else
            SWAP_ENABLED="n"
            echo -e "  ${DIM}Swap already configured (${current_swap} MB)${NC}"
        fi
    else
        SWAP_ENABLED="n"
        echo -e "  ${DIM}Sufficient RAM detected (${total_ram} MB), swap not needed${NC}"
    fi
}

wizard_confirm() {
    echo ""
    separator
    echo -e "  ${BOLD}STEP 6/6 -- Summary${NC}"
    separator
    echo ""
    echo -e "  Mode:             ${BOLD}${DEPLOY_MODE}${NC}"

    case "$DEPLOY_MODE" in
        single)
            echo -e "  Frontend Domain:  ${BOLD}${FRONTEND_DOMAIN}${NC}"
            echo -e "  Backend Domain:   ${BOLD}${BACKEND_DOMAIN}${NC}"
            ;;
        split-frontend)
            echo -e "  Frontend Domain:  ${BOLD}${FRONTEND_DOMAIN}${NC}"
            echo -e "  Backend URL:      ${BOLD}${BACKEND_URL}${NC}"
            ;;
        split-backend)
            echo -e "  Backend Domain:   ${BOLD}${BACKEND_DOMAIN}${NC}"
            echo -e "  Frontend URL:     ${BOLD}${FRONTEND_URL}${NC}"
            ;;
    esac

    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        echo -e "  Admin:            ${BOLD}${ADMIN_USER}${NC} (${ADMIN_EMAIL})"
    fi
    local _ssl_label
    if [ "$SSL_ENABLED" = "y" ]; then
        [ "$SSL_TYPE" = "wildcard" ] && _ssl_label="Yes (wildcard)" || _ssl_label="Yes (per-tenant)"
    else
        _ssl_label="No"
    fi
    echo -e "  SSL:              ${BOLD}${_ssl_label}${NC}"
    echo -e "  Firewall:         ${BOLD}$([ "$UFW_ENABLED" = "y" ] && echo "Yes (UFW)" || echo "No")${NC}"
    echo -e "  Swap:             ${BOLD}$([ "$SWAP_ENABLED" = "y" ] && echo "2 GB" || echo "No")${NC}"
    echo ""

    local confirm=""
    prompt_yn confirm "Start installation?" "y"
    if [ "$confirm" != "y" ]; then
        echo ""
        echo -e "  ${YELLOW}Installation cancelled.${NC}"
        exit 0
    fi
}

run_wizard() {
    wizard_deployment_mode
    wizard_domains
    wizard_admin
    wizard_ssl
    wizard_extras
    wizard_confirm

    # Adjust total steps based on mode
    case "$DEPLOY_MODE" in
        single)       TOTAL_STEPS=14 ;;
        split-frontend) TOTAL_STEPS=9 ;;
        split-backend)  TOTAL_STEPS=13 ;;
    esac
}

# =============================================================================
# Dependency Installation
# =============================================================================

install_dependencies() {
    step "Installing dependencies..."

    # Update package lists
    apt-get update -qq >> "$LOG_FILE" 2>&1

    # Base tools
    local base_pkgs="curl wget git openssl build-essential software-properties-common"
    for pkg in $base_pkgs; do
        if dpkg -s "$pkg" &>/dev/null; then
            step_ok "$pkg (already installed)"
        else
            apt-get install -y -qq "$pkg" >> "$LOG_FILE" 2>&1
            step_new "$pkg (installed)"
        fi
    done

    # Node.js
    if command -v node &>/dev/null; then
        local node_ver
        node_ver=$(node -v)
        step_ok "Node.js ${node_ver} (already installed)"
    else
        curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >> "$LOG_FILE" 2>&1
        apt-get install -y -qq nodejs >> "$LOG_FILE" 2>&1
        step_new "Node.js $(node -v) (installed)"
    fi

    # Docker (only for single + split-backend)
    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        if command -v docker &>/dev/null; then
            step_ok "Docker $(docker --version | awk '{print $3}' | tr -d ',') (already installed)"
        else
            curl -fsSL https://get.docker.com | bash >> "$LOG_FILE" 2>&1
            systemctl enable docker >> "$LOG_FILE" 2>&1
            systemctl start docker >> "$LOG_FILE" 2>&1
            step_new "Docker $(docker --version | awk '{print $3}' | tr -d ',') (installed)"
        fi

        # Docker Compose plugin
        if docker compose version &>/dev/null; then
            step_ok "Docker Compose (already installed)"
        else
            apt-get install -y -qq docker-compose-plugin >> "$LOG_FILE" 2>&1
            step_new "Docker Compose (installed)"
        fi

        # Python 3
        if command -v python3 &>/dev/null; then
            step_ok "Python $(python3 --version | awk '{print $2}') (already installed)"
        else
            apt-get install -y -qq python3 python3-pip python3-venv >> "$LOG_FILE" 2>&1
            step_new "Python $(python3 --version | awk '{print $2}') (installed)"
        fi
    fi

    # Nginx
    if command -v nginx &>/dev/null; then
        step_ok "Nginx $(nginx -v 2>&1 | awk -F/ '{print $2}') (already installed)"
    else
        apt-get install -y -qq nginx >> "$LOG_FILE" 2>&1
        systemctl enable nginx >> "$LOG_FILE" 2>&1
        step_new "Nginx (installed)"
    fi

    # Certbot
    if [ "$SSL_ENABLED" = "y" ]; then
        if command -v certbot &>/dev/null; then
            step_ok "Certbot (already installed)"
        else
            apt-get install -y -qq certbot python3-certbot-nginx >> "$LOG_FILE" 2>&1
            step_new "Certbot (installed)"
        fi
    fi

    # PM2 (only for single + split-backend)
    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        if command -v pm2 &>/dev/null; then
            step_ok "PM2 $(pm2 -v) (already installed)"
        else
            npm install -g pm2 >> "$LOG_FILE" 2>&1
            step_new "PM2 $(pm2 -v) (installed)"
        fi
    fi
}

# =============================================================================
# User & Directory Setup
# =============================================================================

setup_user_dirs() {
    step "Creating user and directories..."

    # Create system user
    if id "$INSTALL_USER" &>/dev/null; then
        step_ok "User '$INSTALL_USER' already exists"
    else
        useradd -r -m -s /bin/bash "$INSTALL_USER"
        step_new "User '$INSTALL_USER' created"
    fi

    # Add to docker group (backend modes only)
    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        if getent group docker &>/dev/null; then
            usermod -aG docker "$INSTALL_USER" 2>/dev/null || true
            step_ok "User added to docker group"
        fi
    fi

    # Create directories
    local dirs=(
        "$INSTALL_DIR"
        "$INSTALL_DIR/logs"
        "$INSTALL_DIR/nginx/sites-enabled"
    )

    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        dirs+=(
            "$INSTALL_DIR/projects"
            "$INSTALL_DIR/backups"
        )
    fi

    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        step_ok "Created $dir"
    done

    chown -R "$INSTALL_USER":"$INSTALL_USER" "$INSTALL_DIR"
}

# =============================================================================
# Git Clone
# =============================================================================

clone_repo() {
    step "Cloning repository..."

    if [ -d "$INSTALL_DIR/.git" ]; then
        step_ok "Repository already exists, pulling latest..."
        cd "$INSTALL_DIR"
        sudo -u "$INSTALL_USER" git pull origin "$REPO_BRANCH" >> "$LOG_FILE" 2>&1
        step_ok "Repository updated"
    else
        # Clone into a temp dir first, then move contents
        local tmp_dir
        tmp_dir=$(mktemp -d)
        git clone --branch "$REPO_BRANCH" "$REPO_URL" "$tmp_dir" >> "$LOG_FILE" 2>&1

        # Move contents (preserving dirs we already created)
        cp -a "$tmp_dir"/. "$INSTALL_DIR"/
        rm -rf "$tmp_dir"

        chown -R "$INSTALL_USER":"$INSTALL_USER" "$INSTALL_DIR"
        step_ok "Repository cloned to $INSTALL_DIR"
    fi
}

# =============================================================================
# Python Environment
# =============================================================================

setup_python() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Setting up Python environment..."

    local venv_dir="$INSTALL_DIR/venv"

    if [ -d "$venv_dir" ]; then
        step_ok "Virtual environment already exists"
    else
        sudo -u "$INSTALL_USER" python3 -m venv "$venv_dir"
        step_new "Virtual environment created"
    fi

    # Install requirements
    if [ -f "$INSTALL_DIR/requirements.txt" ]; then
        sudo -u "$INSTALL_USER" "$venv_dir/bin/pip" install -r "$INSTALL_DIR/requirements.txt" >> "$LOG_FILE" 2>&1
        step_ok "Python requirements installed (psutil, requests, pyjwt)"
    else
        step_skip "No requirements.txt found"
    fi
}

# =============================================================================
# Build Backend
# =============================================================================

build_backend() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Building backend..."

    cd "$INSTALL_DIR/dashboard/backend"

    sudo -u "$INSTALL_USER" npm ci --omit=dev >> "$LOG_FILE" 2>&1
    step_ok "Dependencies installed"

    sudo -u "$INSTALL_USER" npx prisma generate >> "$LOG_FILE" 2>&1
    step_ok "Prisma client generated"

    sudo -u "$INSTALL_USER" npm run build >> "$LOG_FILE" 2>&1
    step_ok "Backend built"

    # Ensure data directory exists for SQLite
    mkdir -p "$INSTALL_DIR/dashboard/backend/data"
    chown -R "$INSTALL_USER":"$INSTALL_USER" "$INSTALL_DIR/dashboard/backend/data"

    sudo -u "$INSTALL_USER" npx prisma migrate deploy >> "$LOG_FILE" 2>&1
    step_ok "Database migrations applied"
}

# =============================================================================
# Build Frontend
# =============================================================================

build_frontend() {
    if [ "$DEPLOY_MODE" = "split-backend" ]; then
        return
    fi

    step "Building frontend..."

    cd "$INSTALL_DIR/dashboard/frontend"

    sudo -u "$INSTALL_USER" npm ci >> "$LOG_FILE" 2>&1
    step_ok "Dependencies installed"

    sudo -u "$INSTALL_USER" npm run build >> "$LOG_FILE" 2>&1
    step_ok "Frontend built"
}

# =============================================================================
# Generate Configuration Files
# =============================================================================

generate_configs() {
    step "Generating configuration files..."

    local session_secret
    session_secret=$(generate_secret)

    # Backend .env (only for single + split-backend)
    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        cat > "$INSTALL_DIR/dashboard/backend/.env" <<EOF
# Multibase Backend Configuration
# Generated by installer v${SCRIPT_VERSION} on $(date)

# Server
PORT=3001
NODE_ENV=production

# Database (SQLite)
DATABASE_URL="file:./data/multibase.db"

# Redis
REDIS_URL=redis://localhost:6379

# Docker
DOCKER_SOCKET_PATH=/var/run/docker.sock

# Paths
PROJECTS_PATH=${INSTALL_DIR}/projects
PYTHON_PATH=${INSTALL_DIR}/venv/bin/python3
BACKUP_PATH=${INSTALL_DIR}/backups
SHARED_DIR=${INSTALL_DIR}/shared

# Domains
BACKEND_DOMAIN=${BACKEND_DOMAIN}
FRONTEND_DOMAIN=${FRONTEND_DOMAIN:-${BACKEND_DOMAIN}}
DASHBOARD_URL=https://${FRONTEND_DOMAIN:-${BACKEND_DOMAIN}}
BACKEND_URL=https://${BACKEND_DOMAIN}

# SSL / Certbot
SSL_EMAIL=${SSL_EMAIL}
CERTBOT_EMAIL=${SSL_EMAIL}
SSL_TYPE=${SSL_TYPE:-per-tenant}

# App URLs
APP_URL=https://${FRONTEND_DOMAIN:-${BACKEND_DOMAIN}}
DASHBOARD_URL=https://${FRONTEND_DOMAIN:-${BACKEND_DOMAIN}}

# CORS
CORS_ORIGIN=${FRONTEND_URL}

# Logging
LOG_LEVEL=info

# Metrics
METRICS_INTERVAL=15000
HEALTH_CHECK_INTERVAL=10000
ALERT_CHECK_INTERVAL=60000

# Session
SESSION_SECRET=${session_secret}
EOF
        chown "$INSTALL_USER":"$INSTALL_USER" "$INSTALL_DIR/dashboard/backend/.env"
        step_ok "Backend .env created"
    fi

    # Frontend .env (only for single + split-frontend)
    if [ "$DEPLOY_MODE" != "split-backend" ]; then
        cat > "$INSTALL_DIR/dashboard/frontend/.env" <<EOF
# Multibase Frontend Configuration
# Generated by installer v${SCRIPT_VERSION} on $(date)
VITE_API_URL=${BACKEND_URL}
EOF
        chown "$INSTALL_USER":"$INSTALL_USER" "$INSTALL_DIR/dashboard/frontend/.env"
        step_ok "Frontend .env created (VITE_API_URL=${BACKEND_URL})"
    fi

    # PM2 ecosystem (only for single + split-backend)
    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        cat > "$INSTALL_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [{
    name: '${PM2_APP_NAME}',
    cwd: '${INSTALL_DIR}/dashboard/backend',
    script: 'dist/server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '512M',
    wait_ready: true,
    listen_timeout: 30000,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '${INSTALL_DIR}/logs/backend-error.log',
    out_file: '${INSTALL_DIR}/logs/backend-out.log'
  }]
};
EOF
        chown "$INSTALL_USER":"$INSTALL_USER" "$INSTALL_DIR/ecosystem.config.js"
        step_ok "PM2 ecosystem.config.js created"
    fi
}

# =============================================================================
# Sudoers – nginx reload + certbot without password prompt
# =============================================================================

setup_sudoers() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Configuring sudoers for nginx and certbot..."

    cat > /etc/sudoers.d/multibase <<EOF
# Multibase: allow backend service to reload nginx and run certbot without password
${INSTALL_USER} ALL=(ALL) NOPASSWD: /usr/sbin/nginx -s reload
${INSTALL_USER} ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
${INSTALL_USER} ALL=(ALL) NOPASSWD: /usr/bin/certbot *
${INSTALL_USER} ALL=(ALL) NOPASSWD: /snap/bin/certbot *
EOF
    chmod 440 /etc/sudoers.d/multibase
    visudo -c -f /etc/sudoers.d/multibase >> "$LOG_FILE" 2>&1
    step_ok "sudoers configured for ${INSTALL_USER} (nginx + certbot)"
}

# =============================================================================
# Shared Infrastructure Setup
# =============================================================================

setup_shared_infra() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Setting up Shared Infrastructure..."

    local shared_dir="${INSTALL_DIR}/shared"
    local python="${INSTALL_DIR}/venv/bin/python3"

    # 1. Generate .env.shared with secure secrets (only if not present)
    if [ ! -f "${shared_dir}/.env.shared" ]; then
        sudo -u "$INSTALL_USER" "$python" "${INSTALL_DIR}/setup_shared.py" init >> "$LOG_FILE" 2>&1
        step_ok ".env.shared generated with secure secrets"
    else
        step_ok ".env.shared already exists – skipping generation"
    fi

    # 2. Patch SHARED_PUBLIC_URL to the configured backend domain
    if [ -n "$BACKEND_DOMAIN" ]; then
        sed -i "s|SHARED_PUBLIC_URL=.*|SHARED_PUBLIC_URL=https://${BACKEND_DOMAIN}|" \
            "${shared_dir}/.env.shared"
    fi

    # 3. Start shared stack (PostgreSQL, Studio, Analytics, Nginx-Gateway, ...)
    sudo -u "$INSTALL_USER" "$python" "${INSTALL_DIR}/setup_shared.py" start >> "$LOG_FILE" 2>&1
    step_ok "Shared stack started"

    # 4. Wait for PostgreSQL to be ready (max 60 s)
    step "Waiting for PostgreSQL to be ready..."
    local retries=0
    until docker exec multibase-db pg_isready -U postgres -q 2>/dev/null; do
        retries=$((retries + 1))
        if [ "$retries" -ge 60 ]; then
            step_fail "PostgreSQL did not become ready within 60 seconds"
            error_exit "Shared PostgreSQL failed to start — check 'docker logs multibase-db'"
        fi
        sleep 1
    done
    step_ok "PostgreSQL is ready"
}

# =============================================================================
# Redis Container
# =============================================================================

start_redis() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Starting Redis..."

    if docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
        step_ok "Redis container already running"
    else
        # Remove stopped container if exists
        docker rm -f "$REDIS_CONTAINER" &>/dev/null || true

        docker run -d \
            --name "$REDIS_CONTAINER" \
            --restart unless-stopped \
            -p 6379:6379 \
            redis:7-alpine >> "$LOG_FILE" 2>&1

        step_new "Redis container started"
    fi
}

# =============================================================================
# Nginx Configuration
# =============================================================================

configure_nginx() {
    step "Configuring Nginx..."

    # Frontend vhost (single + split-frontend)
    if [ "$DEPLOY_MODE" != "split-backend" ]; then
        cat > /etc/nginx/sites-available/multibase-frontend <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${FRONTEND_DOMAIN};
    root ${INSTALL_DIR}/dashboard/frontend/dist;

    # HTTPS redirect
    if (\$scheme != "https") {
        rewrite ^ https://\$host\$request_uri permanent;
    }

    # Let's Encrypt challenge
    location ~ /.well-known {
        auth_basic off;
        allow all;
    }

    # API Proxy to backend
    location /api {
        proxy_pass ${BACKEND_URL};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host ${BACKEND_DOMAIN};
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket proxy (Socket.IO for realtime logs)
    location /socket.io {
        proxy_pass ${BACKEND_URL};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host ${BACKEND_DOMAIN};
        proxy_read_timeout 3600s;
    }

    # Static asset caching
    location ~* ^.+\.(css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2|ttf|otf|eot|webp|mp4|ogg|webm|zip)$ {
        add_header Access-Control-Allow-Origin "*";
        expires max;
        access_log off;
    }

    # React Router SPA fallback
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
        ln -sf /etc/nginx/sites-available/multibase-frontend /etc/nginx/sites-enabled/
        step_ok "Frontend vhost created (${FRONTEND_DOMAIN})"
    fi

    # Backend vhost (single + split-backend)
    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        cat > /etc/nginx/sites-available/multibase-backend <<EOF
server {
    server_name ${BACKEND_DOMAIN};
    listen 80;
    client_max_body_size 100M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 3600s;
    }
}

# Include dynamic instance configs
include ${INSTALL_DIR}/nginx/sites-enabled/*.conf;
EOF
        ln -sf /etc/nginx/sites-available/multibase-backend /etc/nginx/sites-enabled/
        step_ok "Backend vhost created (${BACKEND_DOMAIN})"
    fi

    # Remove default site if it exists
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

    # Test and reload
    nginx -t >> "$LOG_FILE" 2>&1
    systemctl reload nginx
    step_ok "Nginx configuration tested and reloaded"
}

# =============================================================================
# Shared Infrastructure – Systemd Auto-Start
# =============================================================================

setup_shared_autostart() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Configuring Shared Infrastructure auto-start on boot..."

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
ExecStop=/usr/bin/docker compose \\
    -f ${INSTALL_DIR}/shared/docker-compose.shared.yml \\
    --env-file ${INSTALL_DIR}/shared/.env.shared down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable multibase-shared.service
    step_ok "multibase-shared.service enabled (auto-start on reboot)"
}

# =============================================================================
# PM2 Setup
# =============================================================================

start_pm2() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Starting backend via PM2..."

    # Stop existing if running
    sudo -u "$INSTALL_USER" pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

    # Start with ecosystem file
    cd "$INSTALL_DIR"
    sudo -u "$INSTALL_USER" pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1
    step_ok "Backend started"

    # Save PM2 process list
    sudo -u "$INSTALL_USER" pm2 save >> "$LOG_FILE" 2>&1
    step_ok "PM2 process list saved"

    # Setup PM2 startup script
    pm2 startup systemd -u "$INSTALL_USER" --hp "/home/$INSTALL_USER" >> "$LOG_FILE" 2>&1
    step_ok "PM2 startup configured (auto-start on reboot)"

    # Install log rotation
    sudo -u "$INSTALL_USER" pm2 install pm2-logrotate >> "$LOG_FILE" 2>&1
    step_ok "PM2 log rotation enabled"
}

# =============================================================================
# SSL Setup
# =============================================================================

setup_ssl() {
    if [ "$SSL_ENABLED" != "y" ]; then
        return
    fi

    step "Setting up SSL certificates..."

    local domains=()

    if [ "$DEPLOY_MODE" != "split-backend" ]; then
        domains+=("$FRONTEND_DOMAIN")
    fi

    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        domains+=("$BACKEND_DOMAIN")
    fi

    if [ "$SSL_TYPE" = "wildcard" ]; then
        # Wildcard: one cert per unique base domain via DNS-01 challenge
        local base_domains=()
        for domain in "${domains[@]}"; do
            # Strip one subdomain level to get base domain (e.g. api.example.com → example.com)
            local base
            base=$(echo "$domain" | awk -F. 'NF>=2{print $(NF-1)"."$NF}')
            local found=0
            for bd in "${base_domains[@]:-}"; do [ "$bd" = "$base" ] && found=1; done
            [ $found -eq 0 ] && base_domains+=("$base")
        done

        for base in "${base_domains[@]}"; do
            if [ -d "/etc/letsencrypt/live/${base}" ] || [ -d "/etc/letsencrypt/live/*.${base}" ]; then
                step_ok "Wildcard SSL certificate for *.${base} already exists"
            else
                echo ""
                echo -e "  ${YELLOW}ACTION REQUIRED for wildcard cert *.${base}${NC}"
                echo -e "  ${DIM}certbot will ask you to add a DNS TXT record.${NC}"
                echo -e "  ${DIM}Add the record, wait ~60 s for DNS propagation, then press Enter.${NC}"
                echo ""
                certbot certonly \
                    --manual \
                    --preferred-challenges dns \
                    -d "*.${base}" \
                    -d "${base}" \
                    --email "$SSL_EMAIL" \
                    --agree-tos
                # Install cert into nginx for each domain
                for domain in "${domains[@]}"; do
                    local d_base
                    d_base=$(echo "$domain" | awk -F. 'NF>=2{print $(NF-1)"."$NF}')
                    if [ "$d_base" = "$base" ]; then
                        certbot install \
                            --nginx \
                            -d "$domain" \
                            --cert-name "${base}" >> "$LOG_FILE" 2>&1 || true
                    fi
                done
                step_new "Wildcard SSL certificate obtained for *.${base}"
            fi
        done
    else
        for domain in "${domains[@]}"; do
            if [ -d "/etc/letsencrypt/live/$domain" ]; then
                step_ok "SSL certificate for $domain already exists"
            else
                certbot --nginx \
                    -d "$domain" \
                    --email "$SSL_EMAIL" \
                    --agree-tos \
                    --non-interactive \
                    --redirect >> "$LOG_FILE" 2>&1
                step_new "SSL certificate obtained for $domain"
            fi
        done
    fi
}

# =============================================================================
# Firewall & Swap
# =============================================================================

setup_firewall_swap() {
    step "Configuring firewall and swap..."

    # UFW
    if [ "$UFW_ENABLED" = "y" ]; then
        ufw allow 22/tcp >> "$LOG_FILE" 2>&1
        ufw allow 80/tcp >> "$LOG_FILE" 2>&1
        ufw allow 443/tcp >> "$LOG_FILE" 2>&1
        ufw --force enable >> "$LOG_FILE" 2>&1
        step_ok "UFW firewall enabled (ports 22, 80, 443)"
    else
        step_skip "UFW firewall (disabled)"
    fi

    # Swap
    if [ "$SWAP_ENABLED" = "y" ]; then
        if [ ! -f /swapfile ]; then
            fallocate -l 2G /swapfile
            chmod 600 /swapfile
            mkswap /swapfile >> "$LOG_FILE" 2>&1
            swapon /swapfile
            echo '/swapfile none swap sw 0 0' >> /etc/fstab
            step_new "2 GB swap file created"
        else
            step_ok "Swap file already exists"
        fi
    else
        step_skip "Swap file (disabled)"
    fi
}

# =============================================================================
# Admin User Creation
# =============================================================================

create_admin() {
    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        return
    fi

    step "Creating admin account..."

    cd "$INSTALL_DIR/dashboard/backend"

    # Create a temporary Node.js script to seed the admin user
    cat > /tmp/multibase-create-admin.js <<'SCRIPT'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
    const prisma = new PrismaClient();

    const username = process.env.ADMIN_USER;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASS;

    // Check if admin already exists
    const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { username }] }
    });

    if (existing) {
        console.log('Admin user already exists, skipping.');
        await prisma.$disconnect();
        return;
    }

    const hash = await bcrypt.hash(password, 12);

    await prisma.user.create({
        data: {
            username,
            email,
            passwordHash: hash,
            role: 'admin',
            isActive: true,
            isEmailVerified: true
        }
    });

    console.log('Admin user created successfully.');
    await prisma.$disconnect();
}

main().catch(e => {
    console.error('Error creating admin:', e.message);
    process.exit(1);
});
SCRIPT

    ADMIN_USER="$ADMIN_USER" \
    ADMIN_EMAIL="$ADMIN_EMAIL" \
    ADMIN_PASS="$ADMIN_PASS" \
    DATABASE_URL="file:./data/multibase.db" \
    sudo -u "$INSTALL_USER" -E node /tmp/multibase-create-admin.js >> "$LOG_FILE" 2>&1

    rm -f /tmp/multibase-create-admin.js
    step_ok "Admin account created ($ADMIN_USER)"
}

# =============================================================================
# Verification
# =============================================================================

verify_installation() {
    step "Verifying installation..."

    local all_ok=true

    # Check Nginx
    if systemctl is-active --quiet nginx; then
        step_ok "Nginx is running"
    else
        step_fail "Nginx is not running"
        all_ok=false
    fi

    # Check PM2 (backend modes only)
    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        if sudo -u "$INSTALL_USER" pm2 show "$PM2_APP_NAME" &>/dev/null; then
            step_ok "Backend is running via PM2"
        else
            step_fail "Backend is not running"
            all_ok=false
        fi

        # Check Redis
        if docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
            step_ok "Redis container is running"
        else
            step_fail "Redis container is not running"
            all_ok=false
        fi
    fi

    # Check frontend files exist
    if [ "$DEPLOY_MODE" != "split-backend" ]; then
        if [ -f "$INSTALL_DIR/dashboard/frontend/dist/index.html" ]; then
            step_ok "Frontend build files exist"
        else
            step_fail "Frontend build files not found"
            all_ok=false
        fi
    fi

    if [ "$all_ok" = false ]; then
        echo ""
        echo -e "  ${YELLOW}Some checks failed. Review the log: ${LOG_FILE}${NC}"
    fi
}

# =============================================================================
# Completion Screen
# =============================================================================

show_completion() {
    echo ""
    echo -e "${CYAN}======================================================${NC}"
    echo -e "  ${GREEN}${BOLD}Installation Complete!${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo ""

    case "$DEPLOY_MODE" in
        single)
            echo -e "  Frontend:  ${BOLD}https://${FRONTEND_DOMAIN}${NC}"
            echo -e "  Backend:   ${BOLD}https://${BACKEND_DOMAIN}${NC}"
            ;;
        split-frontend)
            echo -e "  Frontend:  ${BOLD}https://${FRONTEND_DOMAIN}${NC}"
            echo -e "  Backend:   ${DIM}${BACKEND_URL} (remote)${NC}"
            ;;
        split-backend)
            echo -e "  Backend:   ${BOLD}https://${BACKEND_DOMAIN}${NC}"
            echo -e "  Frontend:  ${DIM}${FRONTEND_URL} (remote)${NC}"
            ;;
    esac

    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        echo ""
        echo -e "  ${BOLD}Admin Login:${NC}"
        echo -e "    Username:  ${ADMIN_USER}"
        echo -e "    Email:     ${ADMIN_EMAIL}"
        echo -e "    Password:  ${ADMIN_PASS}"
        echo ""
        echo -e "  ${YELLOW}Save these credentials! They will not be shown again.${NC}"
    fi

    echo ""
    echo -e "  ${BOLD}Next Steps:${NC}"
    echo "    - Point your DNS records to this server's IP"

    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        echo "    - Set up *.${BACKEND_DOMAIN} wildcard DNS"
        echo "      for Supabase instance subdomains"
    fi

    if [ "$DEPLOY_MODE" = "split-backend" ]; then
        echo "    - Run the installer on your frontend server"
        echo "      and choose option [2] Split VPS -- Frontend Only"
    fi

    if [ "$DEPLOY_MODE" = "split-frontend" ]; then
        echo "    - Make sure your backend server is running"
    fi

    echo "    - Log in and create your first Supabase instance"

    echo ""
    echo -e "  ${BOLD}Useful Commands:${NC}"

    if [ "$DEPLOY_MODE" != "split-frontend" ]; then
        echo "    pm2 status                     -- Check backend status"
        echo "    pm2 logs multibase-backend     -- View backend logs"
    fi

    echo "    sudo nginx -t                  -- Test Nginx config"
    echo "    sudo systemctl reload nginx    -- Reload Nginx"

    echo ""
    echo -e "  ${BOLD}Management:${NC}"
    echo "    Update:     sudo ${INSTALL_DIR}/deployment/install.sh --update"
    echo "    Uninstall:  sudo ${INSTALL_DIR}/deployment/install.sh --uninstall"

    echo ""
    echo -e "  ${DIM}Install log: ${LOG_FILE}${NC}"
    echo -e "${CYAN}======================================================${NC}"
    echo ""
}

# =============================================================================
# Update Mode
# =============================================================================

run_update() {
    echo ""
    echo -e "${CYAN}Multibase Dashboard -- Update${NC}"
    echo ""

    if [ ! -d "$INSTALL_DIR/.git" ]; then
        error_exit "No installation found at $INSTALL_DIR"
    fi

    TOTAL_STEPS=6
    CURRENT_STEP=0

    step "Pulling latest changes..."
    cd "$INSTALL_DIR"
    sudo -u "$INSTALL_USER" git pull >> "$LOG_FILE" 2>&1
    step_ok "Repository updated"

    step "Rebuilding backend..."
    cd "$INSTALL_DIR/dashboard/backend"
    sudo -u "$INSTALL_USER" npm ci --omit=dev >> "$LOG_FILE" 2>&1
    sudo -u "$INSTALL_USER" npx prisma generate >> "$LOG_FILE" 2>&1
    sudo -u "$INSTALL_USER" npm run build >> "$LOG_FILE" 2>&1
    step_ok "Backend built"

    step "Running database migrations..."
    sudo -u "$INSTALL_USER" npx prisma migrate deploy >> "$LOG_FILE" 2>&1
    step_ok "Migrations applied"

    step "Rebuilding frontend..."
    cd "$INSTALL_DIR/dashboard/frontend"
    sudo -u "$INSTALL_USER" npm ci >> "$LOG_FILE" 2>&1
    sudo -u "$INSTALL_USER" npm run build >> "$LOG_FILE" 2>&1
    step_ok "Frontend built"

    step "Restarting services..."
    sudo -u "$INSTALL_USER" pm2 restart "$PM2_APP_NAME" >> "$LOG_FILE" 2>&1
    step_ok "Backend restarted"
    nginx -t >> "$LOG_FILE" 2>&1
    systemctl reload nginx
    step_ok "Nginx reloaded"

    step "Verifying..."
    if sudo -u "$INSTALL_USER" pm2 show "$PM2_APP_NAME" &>/dev/null; then
        step_ok "Backend is running"
    else
        step_fail "Backend is not running"
    fi

    echo ""
    echo -e "  ${GREEN}${BOLD}Update complete!${NC}"
    echo ""
}

# =============================================================================
# Uninstall Mode
# =============================================================================

run_uninstall() {
    local keep_data=false
    if [[ "${2:-}" == "--keep-data" ]]; then
        keep_data=true
    fi

    echo ""
    echo -e "${CYAN}Multibase Dashboard -- Uninstall${NC}"
    echo ""
    echo "  The following will be removed:"
    echo "    - PM2 processes (${PM2_APP_NAME})"
    echo "    - Nginx vhosts (multibase-frontend, multibase-backend)"
    echo "    - SSL certificates (via certbot)"
    echo "    - Redis container (${REDIS_CONTAINER})"
    echo "    - Install directory (${INSTALL_DIR})"
    echo "    - UFW rules"
    echo "    - System user (${INSTALL_USER})"
    echo ""
    echo "  NOT removed (system packages):"
    echo "    - Node.js, Docker, Nginx, Python3, PM2"

    if [ "$keep_data" = true ]; then
        echo ""
        echo -e "  ${YELLOW}--keep-data: Projects and database will be preserved${NC}"
    fi

    echo ""
    local confirm=""
    prompt_yn confirm "Continue with uninstall?" "n"

    if [ "$confirm" != "y" ]; then
        echo "  Uninstall cancelled."
        exit 0
    fi

    echo ""

    # Stop PM2
    echo -e "  Stopping PM2 processes..."
    sudo -u "$INSTALL_USER" pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
    sudo -u "$INSTALL_USER" pm2 save --force 2>/dev/null || true
    echo -e "  ${GREEN}[OK]${NC} PM2 processes stopped"

    # Remove Nginx vhosts
    echo -e "  Removing Nginx vhosts..."
    rm -f /etc/nginx/sites-enabled/multibase-frontend
    rm -f /etc/nginx/sites-enabled/multibase-backend
    rm -f /etc/nginx/sites-available/multibase-frontend
    rm -f /etc/nginx/sites-available/multibase-backend
    nginx -t &>/dev/null && systemctl reload nginx
    echo -e "  ${GREEN}[OK]${NC} Nginx vhosts removed"

    # Remove SSL certificates
    echo -e "  Removing SSL certificates..."
    for cert_dir in /etc/letsencrypt/live/*/; do
        local cert_name
        cert_name=$(basename "$cert_dir")
        if [[ "$cert_name" == *"multibase"* ]] || [[ "$cert_name" == "$FRONTEND_DOMAIN" ]] || [[ "$cert_name" == "$BACKEND_DOMAIN" ]]; then
            certbot delete --cert-name "$cert_name" --non-interactive 2>/dev/null || true
        fi
    done
    echo -e "  ${GREEN}[OK]${NC} SSL certificates removed"

    # Stop Redis container
    echo -e "  Stopping Redis container..."
    docker stop "$REDIS_CONTAINER" 2>/dev/null || true
    docker rm "$REDIS_CONTAINER" 2>/dev/null || true
    echo -e "  ${GREEN}[OK]${NC} Redis container removed"

    # Remove installation directory
    if [ "$keep_data" = true ]; then
        echo -e "  Preserving data directories..."
        # Keep projects and db, remove everything else
        local data_backup
        data_backup=$(mktemp -d)
        cp -a "$INSTALL_DIR/projects" "$data_backup/" 2>/dev/null || true
        cp -a "$INSTALL_DIR/dashboard/backend/data" "$data_backup/" 2>/dev/null || true
        rm -rf "$INSTALL_DIR"
        mkdir -p "$INSTALL_DIR/projects" "$INSTALL_DIR/dashboard/backend/data"
        cp -a "$data_backup/projects"/. "$INSTALL_DIR/projects/" 2>/dev/null || true
        cp -a "$data_backup/data"/. "$INSTALL_DIR/dashboard/backend/data/" 2>/dev/null || true
        rm -rf "$data_backup"
        echo -e "  ${GREEN}[OK]${NC} Data preserved, application removed"
    else
        rm -rf "$INSTALL_DIR"
        echo -e "  ${GREEN}[OK]${NC} Installation directory removed"
    fi

    # Remove user
    echo -e "  Removing system user..."
    userdel -r "$INSTALL_USER" 2>/dev/null || true
    echo -e "  ${GREEN}[OK]${NC} User removed"

    echo ""
    echo -e "  ${GREEN}${BOLD}Uninstall complete.${NC}"
    echo ""
}

# =============================================================================
# Cleanup Trap
# =============================================================================

cleanup() {
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}Installation failed. Check the log for details: ${LOG_FILE}${NC}"
        echo ""
    fi
    rm -f /tmp/multibase-create-admin.js 2>/dev/null || true
}

trap cleanup EXIT

# =============================================================================
# Main
# =============================================================================

main() {
    # Handle flags
    case "${1:-}" in
        --update)
            preflight_checks
            run_update
            exit 0
            ;;
        --uninstall)
            preflight_checks
            run_uninstall "$@"
            exit 0
            ;;
        --version)
            echo "Multibase Installer v${SCRIPT_VERSION}"
            exit 0
            ;;
        --help|-h)
            echo "Multibase Dashboard Installer v${SCRIPT_VERSION}"
            echo ""
            echo "Usage:"
            echo "  sudo bash install.sh              Fresh installation"
            echo "  sudo bash install.sh --update     Update existing installation"
            echo "  sudo bash install.sh --uninstall  Remove installation"
            echo "  sudo bash install.sh --uninstall --keep-data  Remove but keep data"
            echo ""
            exit 0
            ;;
    esac

    # Fresh installation
    preflight_checks
    show_banner
    run_wizard

    echo ""
    echo -e "${BOLD}Starting installation...${NC}"
    echo ""

    install_dependencies
    setup_user_dirs
    setup_sudoers
    clone_repo
    setup_python
    build_backend
    setup_shared_infra
    build_frontend
    generate_configs
    start_redis
    configure_nginx
    start_pm2
    setup_shared_autostart
    setup_ssl
    setup_firewall_swap
    create_admin
    verify_installation
    show_completion
}

main "$@"
