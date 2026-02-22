#!/usr/bin/env python3
"""
Multibase Cloud Version - Lightweight Tenant Setup

Creates a lightweight Supabase tenant project that uses the SHARED infrastructure
(PostgreSQL, Studio, Analytics, Vector, imgproxy, Meta, Pooler).

Per-tenant containers (6 statt 13):
  - Kong (API Gateway)
  - Auth (GoTrue)
  - REST (PostgREST)
  - Realtime
  - Storage
  - Functions (Edge Runtime)

Usage:
    Von supabase_manager.py aufgerufen:
    python supabase_manager.py create <name> --base-port <port>
"""

import os
import shutil
import socket
import argparse
import subprocess
import random
import string
from pathlib import Path
import hmac
import hashlib
import base64
import json
import time


def generate_jwt_token(secret, role):
    """Generate a JWT token signed with the given secret."""
    header = {'alg': 'HS256', 'typ': 'JWT'}
    now = int(time.time())
    payload = {
        'role': role,
        'iss': 'supabase',
        'iat': now,
        'exp': now + (10 * 365 * 24 * 60 * 60)  # 10 years
    }
    
    def base64url_encode(data):
        return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')
    
    header_b64 = base64url_encode(json.dumps(header).encode())
    payload_b64 = base64url_encode(json.dumps(payload).encode())
    
    message = f'{header_b64}.{payload_b64}'
    signature = hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f'{header_b64}.{payload_b64}.{signature_b64}'


class SupabaseProjectGenerator:
    """
    Cloud-Version: Generiert einen Lightweight Tenant Stack.
    
    Statt 13 Container pro Projekt werden nur 6 tenant-spezifische Container erstellt.
    DB, Studio, Analytics, Vector, imgproxy, Meta, Pooler kommen aus dem Shared Stack.
    """
    
    def __init__(self, project_name, base_port=None):
        """Initialize the generator with project name and optional base port."""
        self.project_dir = Path(project_name)
        self.project_name = self.project_dir.name
        self.base_port = base_port
        
        # Shared Infrastructure Referenz
        self.shared_dir = Path(__file__).parent / "shared"
        self.shared_env = self._load_shared_env()

        # Ask if running on localhost first
        is_localhost = input("Is this setup for localhost? (Y/N): ").strip().upper()

        if is_localhost == 'Y':
            protocol = 'http://'
            domain = 'localhost'
            self.cors_origins_config = '"*"'
            print("Defaulting to protocol: http")
            print("Using domain: localhost")
            print("Configuring CORS to allow all origins (*)")
        else:
            protocol = input("Enter the protocol for your domain (http or https): ").strip()
            if not protocol.endswith("://"):
                protocol += "://"
            domain = input("Enter your domain (e.g., example.com): ").strip()
            self.cors_origins_config = f'"{protocol}{domain}"'

        self.origin = f"{protocol}{domain}"

        # Cloud-Version: Weniger Ports noetig (kein DB, Analytics, Studio, Pooler Port)
        self.ports = self._calculate_ports()
        
        # Create project directory
        self._create_project_directory()
        
        # Templates
        self.templates = {}
        self._initialize_templates()

    def _load_shared_env(self):
        """Load the shared infrastructure .env file."""
        env = {}
        env_file = self.shared_dir / ".env.shared"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env[key.strip()] = value.strip()
        else:
            print("WARNING: shared/.env.shared nicht gefunden!")
            print("   Bitte zuerst 'python setup_shared.py init' ausfuehren.")
        return env

    def run(self):
        """Create project subdirectories and write template files."""
        # Cloud-Version: Weniger Verzeichnisse (kein db/data, analytics, logs, pooler)
        subdirs = [
            "volumes/api",
            "volumes/functions",
            "volumes/storage",
        ]

        for subdir in subdirs:
            dir_path = self.project_dir / subdir
            if dir_path.exists() and not dir_path.is_dir():
                dir_path.unlink()
            dir_path.mkdir(parents=True, exist_ok=True)

        # Edge Functions Verzeichnis
        main_dir = self.project_dir / "volumes/functions/main"
        if main_dir.exists() and not main_dir.is_dir():
            main_dir.unlink()
        main_dir.mkdir(parents=True, exist_ok=True)

        # Write template files
        self._write_with_unix_newlines(self.project_dir / "docker-compose.yml", self.templates["docker_compose"])
        self._write_with_unix_newlines(self.project_dir / ".env", self.templates["env"])
        self._write_with_unix_newlines(self.project_dir / "volumes/api/kong.yml", self.templates["kong"])
        self._create_docker_compose_override()
        (self.project_dir / "volumes/functions/main/index.ts").write_text(self.templates["function_main"])
        (self.project_dir / "reset.sh").write_text(self.templates["reset_script"])
        (self.project_dir / "README.md").write_text(self.templates["readme"])
        
        # Create project database in shared cluster
        self._create_project_database()
        
        # Fix Realtime healthcheck for Windows compatibility
        self._fix_realtime_healthcheck()

    def _write_with_unix_newlines(self, path, content):
        """Write file with Unix line endings (LF only)."""
        content = content.replace('\r\n', '\n')
        path.write_bytes(content.encode('utf-8'))
    
    def _fix_realtime_healthcheck(self):
        """Fix Realtime healthcheck to use simpler check."""
        compose_file = self.project_dir / "docker-compose.yml"
        content = compose_file.read_text()
        
        old_healthcheck = '''    healthcheck:
      test:
        [
          "CMD",
          "curl",
          "-sSfL",
          "--head",
          "-o",
          "/dev/null",
          "-H",
          "Authorization: Bearer ${ANON_KEY}",
          "http://localhost:4000/api/tenants/realtime-dev/health"
        ]'''
        
        new_healthcheck = '''    healthcheck:
      test:
        [
          "CMD-SHELL",
          "curl -sSfL http://localhost:4000/status"
        ]'''
        
        if old_healthcheck in content:
            content = content.replace(old_healthcheck, new_healthcheck)
            self._write_with_unix_newlines(compose_file, content)
            print("Fixed Realtime healthcheck for Windows compatibility")
    
    def _create_docker_compose_override(self):
        """Create docker-compose.override.yml to fix Kong YAML parsing."""
        override_content = """services:
  kong:
    volumes:
      - ./volumes/api/kong.yml:/home/kong/kong.yml:ro,z
    entrypoint: /docker-entrypoint.sh kong docker-start
"""
        override_path = self.project_dir / "docker-compose.override.yml"
        override_path.write_text(override_content)
        print(f"Created docker-compose.override.yml")

    def _create_project_database(self):
        """Create the project database in the shared PostgreSQL cluster."""
        try:
            import sys
            sys.path.insert(0, str(Path(__file__).parent))
            from setup_shared import SharedInfraManager
            manager = SharedInfraManager()
            manager.create_project_db(self.project_name)
        except ImportError:
            print("WARNING: setup_shared.py nicht gefunden - Datenbank muss manuell erstellt werden:")
            db_name = f"project_{self.project_name}".replace('-', '_')
            print(f"   docker exec -i multibase-db psql -U postgres -c 'CREATE DATABASE {db_name};'")
        except Exception as e:
            print(f"WARNING: Datenbank-Erstellung fehlgeschlagen: {e}")
            print(f"   Manuell erstellen mit: python setup_shared.py create-db {self.project_name}")

    def _create_project_directory(self):
        """Create the project directory if it doesn't exist."""
        if self.project_dir.exists():
            raise FileExistsError(f"Directory {self.project_dir} already exists.")
        self.project_dir.mkdir(parents=True)
        print(f"Created directory: {self.project_dir}")

    def _is_port_available(self, port):
        """Check if a port is available."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) != 0

    def _find_available_port(self, start_port, step=1):
        """Find an available port starting from start_port."""
        port = start_port
        while not self._is_port_available(port):
            port += step
        return port

    def _calculate_ports(self):
        """Calculate ports for tenant-specific services only.
        
        Cloud-Version: Nur noch 2 Ports pro Projekt (Kong HTTP + HTTPS).
        DB, Studio, Analytics, Pooler laufen im Shared Stack.
        """
        if self.base_port is None:
            self.base_port = self._find_available_port(random.randint(3000, 9000))
        
        ports = {
            "kong_http": self._find_available_port(self.base_port),
            "kong_https": self._find_available_port(self.base_port + 443),
        }
        
        print(f"Using base port: {self.base_port}")
        print(f"Kong HTTP port: {ports['kong_http']}")
        print(f"Kong HTTPS port: {ports['kong_https']}")
        print(f"[Cloud] DB, Studio, Analytics, Pooler -> Shared Infrastructure")
        
        return ports

    def _initialize_templates(self):
        """Initialize all template content."""
        self._init_docker_compose_template()
        self._init_env_template()
        self._init_kong_template()
        self._init_function_templates()
        self._init_misc_templates()

    def _init_docker_compose_template(self):
        """Initialize the LIGHTWEIGHT docker-compose.yml template.
        
        Cloud-Version: Nur 6 Container statt 13.
        Entfernt: db, vector, analytics, studio, meta, imgproxy, pooler
        """
        self.templates["docker_compose"] = f"""
# Multibase Cloud Version - Lightweight Tenant Stack
# Verwendet Shared Infrastructure: DB, Studio, Analytics, Vector, imgproxy, Meta, Pooler
# Container: kong, auth, rest, realtime, storage, functions (6 statt 13)

name: {self.project_name}

services:
  kong:
    container_name: {self.project_name}-kong
    image: kong:2.8.1
    restart: unless-stopped
    ports:
      - "{self.ports['kong_http']}:8000/tcp"
      - "{self.ports['kong_https']}:8443/tcp"
    volumes:
      - ./volumes/api/kong.yml:/home/kong/temp.yml:ro,z
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /home/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      KONG_NGINX_PROXY_PROXY_BUFFER_SIZE: 160k
      KONG_NGINX_PROXY_PROXY_BUFFERS: 64 160k
      SUPABASE_ANON_KEY: ${{ANON_KEY}}
      SUPABASE_SERVICE_KEY: ${{SERVICE_ROLE_KEY}}
      DASHBOARD_USERNAME: ${{DASHBOARD_USERNAME}}
      DASHBOARD_PASSWORD: ${{DASHBOARD_PASSWORD}}
    entrypoint: bash -c 'eval "echo \\"$$(cat ~/temp.yml)\\"" > ~/kong.yml && /docker-entrypoint.sh kong docker-start'
    networks:
      - multibase-shared
      - default

  auth:
    container_name: {self.project_name}-auth
    image: supabase/gotrue:v2.170.0
    restart: unless-stopped
    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--no-verbose",
          "--tries=1",
          "--spider",
          "http://localhost:9999/health"
        ]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: ${{API_EXTERNAL_URL}}
      GOTRUE_DB_DRIVER: postgres
      # Shared PostgreSQL - Projekt-spezifische Datenbank
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${{POSTGRES_PASSWORD}}@multibase-db:5432/${{PROJECT_DB}}
      GOTRUE_SITE_URL: ${{SITE_URL}}
      GOTRUE_URI_ALLOW_LIST: ${{ADDITIONAL_REDIRECT_URLS}}
      GOTRUE_DISABLE_SIGNUP: ${{DISABLE_SIGNUP}}
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: ${{JWT_EXPIRY}}
      GOTRUE_JWT_SECRET: ${{JWT_SECRET}}
      GOTRUE_EXTERNAL_EMAIL_ENABLED: ${{ENABLE_EMAIL_SIGNUP}}
      GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED: ${{ENABLE_ANONYMOUS_USERS}}
      GOTRUE_MAILER_AUTOCONFIRM: ${{ENABLE_EMAIL_AUTOCONFIRM}}
      GOTRUE_SMTP_ADMIN_EMAIL: ${{SMTP_ADMIN_EMAIL}}
      GOTRUE_SMTP_HOST: ${{SMTP_HOST}}
      GOTRUE_SMTP_PORT: ${{SMTP_PORT}}
      GOTRUE_SMTP_USER: ${{SMTP_USER}}
      GOTRUE_SMTP_PASS: ${{SMTP_PASS}}
      GOTRUE_SMTP_SENDER_NAME: ${{SMTP_SENDER_NAME}}
      GOTRUE_MAILER_URLPATHS_INVITE: ${{MAILER_URLPATHS_INVITE}}
      GOTRUE_MAILER_URLPATHS_CONFIRMATION: ${{MAILER_URLPATHS_CONFIRMATION}}
      GOTRUE_MAILER_URLPATHS_RECOVERY: ${{MAILER_URLPATHS_RECOVERY}}
      GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE: ${{MAILER_URLPATHS_EMAIL_CHANGE}}
      GOTRUE_EXTERNAL_PHONE_ENABLED: ${{ENABLE_PHONE_SIGNUP}}
      GOTRUE_SMS_AUTOCONFIRM: ${{ENABLE_PHONE_AUTOCONFIRM}}
    networks:
      - multibase-shared
      - default

  rest:
    container_name: {self.project_name}-rest
    image: postgrest/postgrest:v12.2.8
    restart: unless-stopped
    environment:
      # Shared PostgreSQL - Projekt-spezifische Datenbank
      PGRST_DB_URI: postgres://authenticator:${{POSTGRES_PASSWORD}}@multibase-db:5432/${{PROJECT_DB}}
      PGRST_DB_SCHEMAS: ${{PGRST_DB_SCHEMAS}}
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${{JWT_SECRET}}
      PGRST_DB_USE_LEGACY_GUCS: "false"
      PGRST_APP_SETTINGS_JWT_SECRET: ${{JWT_SECRET}}
      PGRST_APP_SETTINGS_JWT_EXP: ${{JWT_EXPIRY}}
    command: ["postgrest"]
    networks:
      - multibase-shared
      - default

  realtime:
    container_name: realtime-dev.{self.project_name}-realtime
    image: supabase/realtime:v2.34.43
    restart: unless-stopped
    healthcheck:
      test:
        [
          "CMD",
          "curl",
          "-sSfL",
          "--head",
          "-o",
          "/dev/null",
          "-H",
          "Authorization: Bearer ${{ANON_KEY}}",
          "http://localhost:4000/api/tenants/realtime-dev/health"
        ]
      timeout: 5s
      interval: 5s
      retries: 3
    environment:
      PORT: 4000
      # Shared PostgreSQL
      DB_HOST: multibase-db
      DB_PORT: 5432
      DB_USER: supabase_admin
      DB_PASSWORD: ${{POSTGRES_PASSWORD}}
      DB_NAME: ${{PROJECT_DB}}
      DB_AFTER_CONNECT_QUERY: 'SET search_path TO _realtime'
      DB_ENC_KEY: supabaserealtime
      API_JWT_SECRET: ${{JWT_SECRET}}
      SECRET_KEY_BASE: ${{SECRET_KEY_BASE}}
      ERL_AFLAGS: -proto_dist inet_tcp
      DNS_NODES: "''"
      RLIMIT_NOFILE: "10000"
      APP_NAME: realtime
      SEED_SELF_HOST: true
      RUN_JANITOR: true
    networks:
      - multibase-shared
      - default

  storage:
    container_name: {self.project_name}-storage
    image: supabase/storage-api:v1.19.3
    restart: unless-stopped
    volumes:
      - ./volumes/storage:/var/lib/storage:z
    healthcheck:
      test:
        [
          "CMD",
          "wget",
          "--no-verbose",
          "--tries=1",
          "--spider",
          "http://{self.project_name}-storage:5000/status"
        ]
      timeout: 5s
      interval: 5s
      retries: 3
    depends_on:
      rest:
        condition: service_started
    environment:
      ANON_KEY: ${{ANON_KEY}}
      SERVICE_KEY: ${{SERVICE_ROLE_KEY}}
      POSTGREST_URL: http://{self.project_name}-rest:3000
      PGRST_JWT_SECRET: ${{JWT_SECRET}}
      # Shared PostgreSQL - Projekt-spezifische Datenbank
      DATABASE_URL: postgres://supabase_storage_admin:${{POSTGRES_PASSWORD}}@multibase-db:5432/${{PROJECT_DB}}
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: stub
      GLOBAL_S3_BUCKET: stub
      ENABLE_IMAGE_TRANSFORMATION: "true"
      # Shared imgproxy
      IMGPROXY_URL: http://multibase-imgproxy:5001
    networks:
      - multibase-shared
      - default

  functions:
    container_name: {self.project_name}-edge-functions
    image: supabase/edge-runtime:v1.67.4
    restart: unless-stopped
    volumes:
      - ./volumes/functions:/home/deno/functions:Z
    environment:
      JWT_SECRET: ${{JWT_SECRET}}
      SUPABASE_URL: http://{self.project_name}-kong:8000
      SUPABASE_ANON_KEY: ${{ANON_KEY}}
      SUPABASE_SERVICE_ROLE_KEY: ${{SERVICE_ROLE_KEY}}
      # Shared PostgreSQL
      SUPABASE_DB_URL: postgresql://postgres:${{POSTGRES_PASSWORD}}@multibase-db:5432/${{PROJECT_DB}}
      VERIFY_JWT: "${{FUNCTIONS_VERIFY_JWT}}"
    command: ["start", "--main-service", "/home/deno/functions/main"]
    networks:
      - multibase-shared
      - default

# Shared-Netzwerk (extern, von docker-compose.shared.yml erstellt)
networks:
  multibase-shared:
    external: true
  default:
    name: {self.project_name}-network
"""

    def _init_env_template(self):
        """Initialize .env template - Cloud-Version mit Shared DB Referenz."""
        password = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        jwt_secret = ''.join(random.choices(string.ascii_letters + string.digits, k=48))
        secret_key_base = ''.join(random.choices(string.ascii_letters + string.digits, k=64))
        logflare_key = ''.join(random.choices(string.ascii_letters + string.digits, k=32))
        
        anon_key = generate_jwt_token(jwt_secret, 'anon')
        service_role_key = generate_jwt_token(jwt_secret, 'service_role')
        
        # DB-Name im Shared Cluster
        project_db = f"project_{self.project_name}".replace('-', '_')
        
        self.templates["env"] = f"""############
# Multibase Cloud Version - Tenant Configuration
# Dieses Projekt nutzt die Shared Infrastructure (multibase-shared)
############

############
# Projekt-Datenbank (im Shared PostgreSQL Cluster)
############
PROJECT_DB={project_db}
POSTGRES_PASSWORD={password}

############
# Secrets
############
JWT_SECRET={jwt_secret}
ANON_KEY={anon_key}
SERVICE_ROLE_KEY={service_role_key}
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD={self.project_name}
SECRET_KEY_BASE={secret_key_base}

############
# API Gateway
############
KONG_HTTP_PORT={self.ports['kong_http']}
KONG_HTTPS_PORT={self.ports['kong_https']}

############
# API - Configuration for PostgREST
############
PGRST_DB_SCHEMAS=public,storage,graphql_public

############
# Auth - Configuration for GoTrue
############
SITE_URL=http://localhost:{self.ports['kong_http']}
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=http://localhost:{self.ports['kong_http']}

## Mailer Config
MAILER_URLPATHS_CONFIRMATION="/auth/v1/verify"
MAILER_URLPATHS_INVITE="/auth/v1/verify"
MAILER_URLPATHS_RECOVERY="/auth/v1/verify"
MAILER_URLPATHS_EMAIL_CHANGE="/auth/v1/verify"

## Email auth
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=admin@example.com
SMTP_HOST={self.project_name}-mail
SMTP_PORT=2500
SMTP_USER=fake_mail_user
SMTP_PASS=fake_mail_password
SMTP_SENDER_NAME=fake_sender
ENABLE_ANONYMOUS_USERS=false

## Phone auth
ENABLE_PHONE_SIGNUP=true
ENABLE_PHONE_AUTOCONFIRM=true

############
# Functions
############
FUNCTIONS_VERIFY_JWT=false

############
# Shared Infrastructure Referenz
############
LOGFLARE_API_KEY={logflare_key}
IMGPROXY_ENABLE_WEBP_DETECTION=true
"""

    def _init_kong_template(self):
        """Initialize Kong API Gateway configuration for this tenant."""
        anon_key = self._extract_env_value("ANON_KEY")
        service_key = self._extract_env_value("SERVICE_ROLE_KEY")
        dashboard_username = self._extract_env_value("DASHBOARD_USERNAME")
        dashboard_password = self._extract_env_value("DASHBOARD_PASSWORD")
        cors_origins_setting = self.cors_origins_config

        self.templates["kong"] = f"""_format_version: '2.1'
_transform: true

consumers:
  - username: DASHBOARD
  - username: anon
    keyauth_credentials:
      - key: {anon_key}
  - username: service_role
    keyauth_credentials:
      - key: {service_key}

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: admin

basicauth_credentials:
  - consumer: DASHBOARD
    username: {dashboard_username}
    password: {dashboard_password}

services:
  # Auth Routes
  - name: auth-v1
    url: http://{self.project_name}-auth:9999/verify
    routes:
      - name: auth-v1-route
        paths:
          - /auth/v1/verify
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile, prefer, Range, Origin, Referer, Access-Control-Request-Headers, Access-Control-Request-Method]
          exposed_headers: [Content-Length, Content-Range, accept-ranges, Content-Type, Content-Profile, Range-Unit]
          credentials: true
          max_age: 3600

  - name: auth-v1-api
    url: http://{self.project_name}-auth:9999
    routes:
      - name: auth-v1-api-route
        paths:
          - /auth/v1
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile, prefer, Range, Origin, Referer, Access-Control-Request-Headers, Access-Control-Request-Method]
          exposed_headers: [Content-Length, Content-Range, accept-ranges, Content-Type, Content-Profile, Range-Unit]
          credentials: true
          max_age: 3600

  - name: auth-v1-admin
    url: http://{self.project_name}-auth:9999/admin
    routes:
      - name: auth-v1-admin-route
        paths:
          - /auth/v1/admin
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile, prefer, Range, Origin, Referer, Access-Control-Request-Headers, Access-Control-Request-Method]
          exposed_headers: [Content-Length, Content-Range, accept-ranges, Content-Type, Content-Profile, Range-Unit]
          credentials: true
          max_age: 3600
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin

  # REST API
  - name: rest
    url: http://{self.project_name}-rest:3000
    routes:
      - name: rest-route
        paths:
          - /rest/v1
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile, prefer, Range, Origin, Referer, Access-Control-Request-Headers, Access-Control-Request-Method]
          exposed_headers: [Content-Length, Content-Range, accept-ranges, Content-Type, Content-Profile, Range-Unit]
          credentials: true
          max_age: 3600

  # PostgREST Root
  - name: postgrest
    url: http://{self.project_name}-rest:3000
    routes:
      - name: postgrest-route
        paths:
          - /
        strip_path: false
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile]
          exposed_headers: [Content-Length, Content-Range]
          credentials: true
          max_age: 3600

  # Realtime WebSocket
  - name: realtime
    url: http://{self.project_name}-realtime:4000/socket/
    routes:
      - name: realtime-route
        paths:
          - /realtime/v1
        strip_path: true
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile]
          exposed_headers: [Content-Length, Content-Range]
          credentials: true
          max_age: 3600

  - name: realtime-api
    url: http://{self.project_name}-realtime:4000
    routes:
      - name: realtime-api-route
        paths:
          - /api/tenants/realtime-dev
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, HEAD, OPTIONS]
          headers: [Accept, Authorization, Content-Type, apikey]
          exposed_headers: [Content-Length, Content-Range]
          credentials: true
          max_age: 3600

  # Storage
  - name: storage
    url: http://{self.project_name}-storage:5000
    routes:
      - name: storage-route
        paths:
          - /storage/v1
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile]
          exposed_headers: [Content-Length, Content-Range]
          credentials: true
          max_age: 3600

  # Meta (Shared) - ueber Shared Netzwerk erreichbar
  - name: meta
    url: http://multibase-meta:8080
    routes:
      - name: meta-route
        paths:
          - /pg
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile]
          exposed_headers: [Content-Length, Content-Range]
          credentials: true
          max_age: 3600
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin

  # Edge Functions
  - name: functions
    url: http://{self.project_name}-edge-functions:9000
    routes:
      - name: functions-route
        paths:
          - /functions/v1
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, PATCH, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, X-Requested-With, apikey, x-supabase-api-version, x-client-info, accept-profile, content-profile]
          exposed_headers: [Content-Length, Content-Range]
          credentials: true
          max_age: 3600

  # Analytics (Shared)
  - name: analytics
    url: http://multibase-analytics:4000
    routes:
      - name: analytics-route
        paths:
          - /analytics/v1
    plugins:
      - name: cors
        config:
          origins:
            - {cors_origins_setting}
          methods: [GET, POST, PUT, DELETE, OPTIONS]
          headers: [Accept, Authorization, Content-Type, apikey]
          credentials: true
          max_age: 3600
"""

    def _extract_env_value(self, key):
        """Extract a value from the env template."""
        env = self.templates.get("env", "")
        for line in env.splitlines():
            if line.startswith(f"{key}="):
                return line.split("=", 1)[1].strip()
        return f"missing_{key}"

    def _init_function_templates(self):
        """Initialize Edge Function templates."""
        self.templates["function_main"] = """import { serve } from "https://deno.land/std@0.131.0/http/server.ts";

console.log("Hello from Functions!");

serve(async (req) => {
  const { name } = await req.json();
  const data = {
    message: `Hello ${name}!`,
  };

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  );
});"""

    def _init_misc_templates(self):
        """Initialize reset script and readme."""
        project_db = f"project_{self.project_name}".replace('-', '_')
        
        self.templates["reset_script"] = f"""#!/bin/sh
# Reset script for Cloud Version Supabase tenant
# DB bleibt im Shared Cluster - nur tenant-Container werden zurueckgesetzt

echo "Stopping tenant containers..."
docker compose down -v --remove-orphans

echo "Removing tenant storage data..."
rm -rf ./volumes/storage/*

echo "Reset complete."
echo "To also reset the database, run:"
echo "  python setup_shared.py drop-db {self.project_name}"
echo "  python setup_shared.py create-db {self.project_name}"
echo ""
echo "To restart: docker compose up -d"
"""

        self.templates["readme"] = f"""# Supabase Tenant: {self.project_name}

**Multibase Cloud Version** - Lightweight Tenant Stack

## Architektur

Dieses Projekt nutzt die **Shared Infrastructure** (multibase-shared).

### Tenant-Container (6):
- **Kong** - API Gateway (Port {self.ports['kong_http']})
- **Auth** - GoTrue Authentifizierung
- **REST** - PostgREST API
- **Realtime** - WebSocket Subscriptions
- **Storage** - Datei-Storage
- **Functions** - Edge Runtime

### Shared Container (vom multibase-shared Stack):
- PostgreSQL, Studio, Analytics, Vector, imgproxy, Meta, Pooler

## Port Configuration
- Kong HTTP API: {self.ports['kong_http']}
- Kong HTTPS API: {self.ports['kong_https']}

## Quick Start
```bash
# Shared Infrastructure muss laufen!
docker compose up -d
```

## Projekt-Datenbank
- DB-Name: {project_db}
- Host: multibase-db (Shared)
- Port: 5432 (intern)
"""


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Create lightweight Supabase tenant (Cloud Version)')
    parser.add_argument('project_name', help='Name of the project')
    parser.add_argument('--base-port', type=int, default=None, help='Base port number')
    args = parser.parse_args()
    
    try:
        generator = SupabaseProjectGenerator(
            project_name=args.project_name,
            base_port=args.base_port
        )
        generator.run()
        print(f"\n=== Tenant '{args.project_name}' erfolgreich erstellt ===")
        print(f"Container: 6 (statt 13 im Full-Stack)")
        print(f"API Port:  {generator.ports['kong_http']}")
        print(f"DB:        project_{args.project_name.replace('-', '_')} (Shared Cluster)")
        print(f"\nStart mit: cd {args.project_name} && docker compose up -d")
        print(f"(Shared Infrastructure muss laufen: cd shared && docker compose up -d)")
    except Exception as e:
        print(f"Error: {e}")
        raise


if __name__ == "__main__":
    main()
