#!/usr/bin/env python3
"""
Multibase Cloud Version - Shared Infrastructure Setup

Dieses Script initialisiert die Shared Infrastructure:
1. Generiert sichere Secrets (JWT, Passwörter, API-Keys)
2. Schreibt die .env.shared Datei
3. Startet den Shared-Stack (optional)
4. Erstellt Projekt-Datenbanken im Shared PostgreSQL

Usage:
    python setup_shared.py init          # Erstmalige Einrichtung
    python setup_shared.py create-db <name>  # Neue Projekt-DB erstellen
    python setup_shared.py drop-db <name>    # Projekt-DB löschen
    python setup_shared.py list-dbs          # Alle Projekt-DBs auflisten
    python setup_shared.py status            # Status der Shared Services
"""

import os
import sys
import argparse
import subprocess
import random
import string
import json
import time
import hmac
import hashlib
import base64
from pathlib import Path


def generate_random_string(length, chars=None):
    """Generate a random string of specified length."""
    if chars is None:
        chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=length))


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
    
    # Use compact separators to avoid spaces in base64-encoded header/payload
    header_b64 = base64url_encode(json.dumps(header, separators=(',', ':')).encode())
    payload_b64 = base64url_encode(json.dumps(payload, separators=(',', ':')).encode())
    
    message = f'{header_b64}.{payload_b64}'
    signature = hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    
    return f'{header_b64}.{payload_b64}.{signature_b64}'


def write_with_unix_newlines(path, content):
    """Write file with Unix line endings (LF)."""
    content = content.replace('\r\n', '\n')
    Path(path).write_bytes(content.encode('utf-8'))


class SharedInfraManager:
    """Manager für die Shared Infrastructure."""
    
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.shared_dir = self.base_dir / "shared"
        self.env_file = self.shared_dir / ".env.shared"
        self.compose_file = self.shared_dir / "docker-compose.shared.yml"
    
    def init(self, force=False):
        """Initialize shared infrastructure with generated secrets."""
        if self.env_file.exists() and not force:
            print(f"⚠️  .env.shared existiert bereits. Verwende --force zum Überschreiben.")
            return False
        
        print("🔧 Generiere Shared Infrastructure Secrets...")
        
        # Generate all secrets
        postgres_password = generate_random_string(32)
        jwt_secret = generate_random_string(48)
        secret_key_base = generate_random_string(64)
        vault_enc_key = generate_random_string(32)
        logflare_key = generate_random_string(32)
        dashboard_password = generate_random_string(24)
        
        # Generate JWT tokens
        anon_key = generate_jwt_token(jwt_secret, 'anon')
        service_role_key = generate_jwt_token(jwt_secret, 'service_role')
        
        env_content = f"""############################################################
# Multibase Cloud Version - Shared Infrastructure Config
# AUTO-GENERIERT am {time.strftime('%Y-%m-%d %H:%M:%S')}
# ⚠️  NICHT MANUELL BEARBEITEN - Secrets sind automatisch generiert
############################################################

############
# Shared PostgreSQL
############
SHARED_POSTGRES_PASSWORD={postgres_password}
SHARED_PG_PORT=5432
SHARED_JWT_SECRET={jwt_secret}
SHARED_JWT_EXPIRY=3600

############
# Shared Keys
############
SHARED_ANON_KEY={anon_key}
SHARED_SERVICE_ROLE_KEY={service_role_key}
SHARED_SECRET_KEY_BASE={secret_key_base}
SHARED_VAULT_ENC_KEY={vault_enc_key}

############
# Shared Dashboard
############
SHARED_DASHBOARD_USERNAME=supabase
SHARED_DASHBOARD_PASSWORD={dashboard_password}

############
# Shared Studio
############
SHARED_STUDIO_PORT=3000
SHARED_STUDIO_ORG=Multibase
SHARED_STUDIO_PROJECT=default
SHARED_PUBLIC_URL=http://localhost:8000

############
# Shared Kong
############
SHARED_KONG_HTTP_PORT=8000
SHARED_KONG_HTTPS_PORT=8443

############
# Shared Analytics / Logging
############
SHARED_ANALYTICS_PORT=4000
SHARED_LOGFLARE_API_KEY={logflare_key}

############
# Shared Pooler
############
SHARED_POOLER_PORT=6543
SHARED_POOLER_TENANT_ID=multibase-shared
SHARED_POOLER_POOL_SIZE=50
SHARED_POOLER_MAX_CONN=500

############
# Docker
############
DOCKER_SOCKET_LOCATION=/var/run/docker.sock
"""
        
        write_with_unix_newlines(self.env_file, env_content)
        print(f"✅ .env.shared geschrieben: {self.env_file}")
        print(f"")
        print(f"📋 Übersicht:")
        print(f"   PostgreSQL Port:  5432")
        print(f"   Studio Port:      3000")
        print(f"   Kong HTTP Port:   8000")
        print(f"   Analytics Port:   4000")
        print(f"   Pooler Port:      6543")
        print(f"   Dashboard User:   supabase")
        print(f"   Dashboard Pass:   {dashboard_password}")
        print(f"")
        
        return True
    
    def start(self):
        """Start the shared infrastructure stack."""
        print("🚀 Starte Shared Infrastructure...")
        cmd = [
            "docker", "compose",
            "-f", str(self.compose_file),
            "--env-file", str(self.env_file),
            "up", "-d"
        ]
        result = subprocess.run(cmd, cwd=str(self.shared_dir))
        if result.returncode == 0:
            print("✅ Shared Infrastructure gestartet!")
        else:
            print("❌ Fehler beim Starten der Shared Infrastructure")
        return result.returncode
    
    def stop(self):
        """Stop the shared infrastructure stack."""
        print("⏹️  Stoppe Shared Infrastructure...")
        cmd = [
            "docker", "compose",
            "-f", str(self.compose_file),
            "--env-file", str(self.env_file),
            "down"
        ]
        result = subprocess.run(cmd, cwd=str(self.shared_dir))
        return result.returncode
    
    def status(self):
        """Show status of shared infrastructure."""
        cmd = [
            "docker", "compose",
            "-f", str(self.compose_file),
            "--env-file", str(self.env_file),
            "ps", "--format", "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
        ]
        subprocess.run(cmd, cwd=str(self.shared_dir))
    
    def _get_shared_env(self):
        """Read shared .env file and return as dict."""
        env = {}
        if self.env_file.exists():
            for line in self.env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env[key.strip()] = value.strip()
        return env
    
    def _run_sql(self, sql, database="postgres"):
        """Execute SQL on the shared PostgreSQL cluster."""
        env = self._get_shared_env()
        password = env.get('SHARED_POSTGRES_PASSWORD', '')
        port = env.get('SHARED_PG_PORT', '5432')
        
        cmd = [
            "docker", "exec", "-i", "multibase-db",
            "psql", "-U", "postgres", "-d", database, "-c", sql
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result
    
    def _run_sql_file(self, sql_file, database):
        """Execute a SQL file on the shared PostgreSQL cluster."""
        cmd = [
            "docker", "exec", "-i", "multibase-db",
            "psql", "-U", "postgres", "-d", database
        ]
        with open(sql_file, 'r') as f:
            result = subprocess.run(cmd, stdin=f, capture_output=True, text=True)
        return result
    
    def _run_sql_as_admin(self, sql, database="postgres"):
        """Execute SQL as supabase_admin (superuser) on the shared cluster."""
        cmd = [
            "docker", "exec", "-i", "multibase-db",
            "psql", "-U", "supabase_admin", "-d", database, "-c", sql
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result

    def create_project_db(self, project_name):
        """Create a new project database in the shared cluster."""
        db_name = f"project_{project_name}".replace('-', '_')
        
        print(f"📦 Erstelle Projekt-Datenbank: {db_name}")
        
        # 1. Create the database
        result = self._run_sql(f"CREATE DATABASE {db_name};")
        if result.returncode != 0:
            if "already exists" in result.stderr:
                print(f"⚠️  Datenbank {db_name} existiert bereits")
            else:
                print(f"❌ Fehler: {result.stderr}")
                return False
        
        # 2. Initialize Supabase schemas in the new database
        init_sql = """
-- Extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Auth schema (owned by supabase_auth_admin - used by GoTrue)
CREATE SCHEMA IF NOT EXISTS auth;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;

-- Storage schema (owned by supabase_storage_admin)
CREATE SCHEMA IF NOT EXISTS storage;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;

-- Realtime schemas
CREATE SCHEMA IF NOT EXISTS realtime;
ALTER SCHEMA realtime OWNER TO supabase_admin;
CREATE SCHEMA IF NOT EXISTS _realtime;
ALTER SCHEMA _realtime OWNER TO supabase_admin;

-- GraphQL schemas
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE SCHEMA IF NOT EXISTS graphql_public;
ALTER SCHEMA graphql OWNER TO supabase_admin;
ALTER SCHEMA graphql_public OWNER TO supabase_admin;

-- Vault schema
CREATE SCHEMA IF NOT EXISTS vault;
ALTER SCHEMA vault OWNER TO supabase_admin;

-- JWT settings for this project DB
ALTER DATABASE {db} SET "app.settings.jwt_secret" TO '{jwt_secret}';
ALTER DATABASE {db} SET "app.settings.jwt_exp" TO '{jwt_exp}';

-- Public schema grants
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

-- supabase_auth_admin permissions
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA auth GRANT ALL ON ROUTINES TO supabase_auth_admin;

-- supabase_storage_admin permissions
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

-- Database-level grants for service roles (needed for migrations)
GRANT ALL PRIVILEGES ON DATABASE {db} TO supabase_admin;
GRANT ALL PRIVILEGES ON DATABASE {db} TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON DATABASE {db} TO supabase_storage_admin;
"""
        env = self._get_shared_env()
        jwt_secret = env.get('SHARED_JWT_SECRET', '')
        jwt_exp = env.get('SHARED_JWT_EXPIRY', '3600')
        init_sql = init_sql.format(db=db_name, jwt_secret=jwt_secret, jwt_exp=jwt_exp)
        
        result = self._run_sql_as_admin(init_sql, database=db_name)
        if result.returncode != 0:
            print(f"⚠️  Schema-Init Warnung: {result.stderr}")
        
        # 3. Run webhooks setup on the new DB
        webhooks_file = self.shared_dir / "volumes" / "db" / "init" / "98-webhooks.sql"
        if webhooks_file.exists():
            result = self._run_sql_file(str(webhooks_file), db_name)
            if result.returncode != 0:
                print(f"⚠️  Webhooks-Init Warnung: {result.stderr}")
        
        print(f"✅ Projekt-Datenbank {db_name} erstellt und initialisiert!")
        return True
    
    def drop_project_db(self, project_name):
        """Drop a project database from the shared cluster."""
        db_name = f"project_{project_name}".replace('-', '_')
        
        print(f"🗑️  Lösche Projekt-Datenbank: {db_name}")
        
        # Terminate active connections first
        self._run_sql(f"""
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = '{db_name}' AND pid <> pg_backend_pid();
        """)
        
        result = self._run_sql(f"DROP DATABASE IF EXISTS {db_name};")
        if result.returncode == 0:
            print(f"✅ Datenbank {db_name} gelöscht")
            return True
        else:
            print(f"❌ Fehler: {result.stderr}")
            return False
    
    def list_project_dbs(self):
        """List all project databases in the shared cluster."""
        result = self._run_sql(
            "SELECT datname, pg_size_pretty(pg_database_size(datname)) as size "
            "FROM pg_database WHERE datname LIKE 'project_%' ORDER BY datname;"
        )
        if result.returncode == 0:
            print(result.stdout)
        else:
            print(f"❌ Fehler: {result.stderr}")


def main():
    parser = argparse.ArgumentParser(description="Multibase Shared Infrastructure Manager")
    subparsers = parser.add_subparsers(dest="command", help="Verfügbare Befehle")
    
    # Init
    init_parser = subparsers.add_parser("init", help="Shared Infrastructure initialisieren")
    init_parser.add_argument("--force", "-f", action="store_true", help="Bestehende Config überschreiben")
    
    # Start/Stop/Status
    subparsers.add_parser("start", help="Shared Stack starten")
    subparsers.add_parser("stop", help="Shared Stack stoppen")
    subparsers.add_parser("status", help="Status anzeigen")
    
    # Database management
    create_db = subparsers.add_parser("create-db", help="Projekt-Datenbank erstellen")
    create_db.add_argument("name", help="Projektname")
    
    drop_db = subparsers.add_parser("drop-db", help="Projekt-Datenbank löschen")
    drop_db.add_argument("name", help="Projektname")
    
    subparsers.add_parser("list-dbs", help="Alle Projekt-Datenbanken auflisten")
    
    args = parser.parse_args()
    manager = SharedInfraManager()
    
    if args.command == "init":
        manager.init(force=args.force)
    elif args.command == "start":
        manager.start()
    elif args.command == "stop":
        manager.stop()
    elif args.command == "status":
        manager.status()
    elif args.command == "create-db":
        manager.create_project_db(args.name)
    elif args.command == "drop-db":
        manager.drop_project_db(args.name)
    elif args.command == "list-dbs":
        manager.list_project_dbs()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
