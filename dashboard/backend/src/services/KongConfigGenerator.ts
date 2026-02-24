/**
 * KongConfigGenerator - Generates dynamic Kong declarative config
 * for the shared Kong gateway, routing all Supabase services
 * to the currently active tenant's containers.
 *
 * All tenant containers are already on the `multibase-shared` network,
 * so Kong can reach them by container name.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { parseEnvFile } from '../utils/envParser';

export interface KongGeneratorOptions {
  /** e.g. "cloud-test" */
  tenantName: string;
  /** Path to the shared directory (contains .env.shared, volumes/api/) */
  sharedDir: string;
  /** Path to the projects directory */
  projectsDir: string;
}

/**
 * Reads the shared and tenant env files to extract keys,
 * then produces a full kong.yml with all Supabase routes
 * pointing to the active tenant's containers.
 */
export function generateKongConfig(options: KongGeneratorOptions): string {
  const { tenantName, sharedDir, projectsDir } = options;

  // Read shared env for keys
  const sharedEnvPath = path.join(sharedDir, '.env.shared');
  const sharedEnv = fs.existsSync(sharedEnvPath) ? parseEnvFile(sharedEnvPath) : {};

  // Read tenant env for keys (tenant may have its own ANON_KEY etc.)
  const tenantEnvPath = path.join(projectsDir, tenantName, '.env');
  const tenantEnv = fs.existsSync(tenantEnvPath) ? parseEnvFile(tenantEnvPath) : {};

  // Use shared keys (all tenants share the same JWT_SECRET / keys)
  const anonKey = sharedEnv['SHARED_ANON_KEY'] || tenantEnv['ANON_KEY'] || '';
  const serviceKey = sharedEnv['SHARED_SERVICE_ROLE_KEY'] || tenantEnv['SERVICE_ROLE_KEY'] || '';
  const dashboardUsername = sharedEnv['SHARED_DASHBOARD_USERNAME'] || 'supabase';
  const dashboardPassword = sharedEnv['SHARED_DASHBOARD_PASSWORD'] || tenantEnv['DASHBOARD_PASSWORD'] || '';

  // Container name prefix = tenantName
  const authHost = `${tenantName}-auth`;
  const restHost = `${tenantName}-rest`;
  const storageHost = `${tenantName}-storage`;
  const realtimeHost = `realtime-dev.${tenantName}-realtime`;
  const functionsHost = `${tenantName}-edge-functions`;

  // Shared services (always the same)
  const metaHost = 'multibase-meta';
  const analyticsHost = 'multibase-analytics';

  const corsPlugin = `
      - name: cors
        config:
          origins:
            - "*"
          methods:
            - GET
            - POST
            - PUT
            - PATCH
            - DELETE
            - OPTIONS
          headers:
            - Accept
            - Authorization
            - Content-Type
            - X-Requested-With
            - apikey
            - x-supabase-api-version
            - x-client-info
            - accept-profile
            - content-profile
            - prefer
            - Range
            - Origin
            - Referer
            - Access-Control-Request-Headers
            - Access-Control-Request-Method
          exposed_headers:
            - Content-Length
            - Content-Range
            - accept-ranges
            - Content-Type
            - Content-Profile
            - Range-Unit
          credentials: true
          max_age: 3600`;

  const config = `# Auto-generated Kong config for active tenant: ${tenantName}
# Generated at: ${new Date().toISOString()}
# DO NOT EDIT MANUALLY - This file is regenerated on tenant switch.

_format_version: '2.1'
_transform: true

consumers:
  - username: DASHBOARD
  - username: anon
    keyauth_credentials:
      - key: ${anonKey}
  - username: service_role
    keyauth_credentials:
      - key: ${serviceKey}

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: admin

basicauth_credentials:
  - consumer: DASHBOARD
    username: ${dashboardUsername}
    password: ${dashboardPassword}

services:
  # ===== Auth Routes (Tenant: ${tenantName}) =====
  - name: auth-v1
    url: http://${authHost}:9999/verify
    routes:
      - name: auth-v1-route
        paths:
          - /auth/v1/verify
    plugins:
${corsPlugin}

  - name: auth-v1-api
    url: http://${authHost}:9999
    routes:
      - name: auth-v1-api-route
        paths:
          - /auth/v1
    plugins:
${corsPlugin}

  - name: auth-v1-admin
    url: http://${authHost}:9999/admin
    routes:
      - name: auth-v1-admin-route
        paths:
          - /auth/v1/admin
    plugins:
${corsPlugin}
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin

  # ===== REST API (Tenant: ${tenantName}) =====
  - name: rest
    url: http://${restHost}:3000
    routes:
      - name: rest-route
        paths:
          - /rest/v1
    plugins:
${corsPlugin}

  - name: postgrest
    url: http://${restHost}:3000
    routes:
      - name: postgrest-route
        paths:
          - /
        strip_path: false
    plugins:
${corsPlugin}

  # ===== Realtime WebSocket (Tenant: ${tenantName}) =====
  - name: realtime
    url: http://${realtimeHost}:4000/socket/
    routes:
      - name: realtime-route
        paths:
          - /realtime/v1
        strip_path: true
    plugins:
${corsPlugin}

  - name: realtime-api
    url: http://${realtimeHost}:4000
    routes:
      - name: realtime-api-route
        paths:
          - /api/tenants/realtime-dev
    plugins:
${corsPlugin}

  # ===== Storage (Tenant: ${tenantName}) =====
  - name: storage
    url: http://${storageHost}:5000
    routes:
      - name: storage-route
        paths:
          - /storage/v1
    plugins:
${corsPlugin}

  # ===== Edge Functions (Tenant: ${tenantName}) =====
  - name: functions
    url: http://${functionsHost}:9000
    routes:
      - name: functions-route
        paths:
          - /functions/v1
    plugins:
${corsPlugin}

  # ===== Meta API (Shared) =====
  - name: meta
    url: http://${metaHost}:8080
    routes:
      - name: meta-route
        paths:
          - /pg
    plugins:
${corsPlugin}
      - name: key-auth
        config:
          hide_credentials: true
      - name: acl
        config:
          hide_groups_header: true
          allow:
            - admin

  # ===== Analytics (Shared) =====
  - name: analytics
    url: http://${analyticsHost}:4000
    routes:
      - name: analytics-route
        paths:
          - /analytics/v1
    plugins:
${corsPlugin}
`;

  return config;
}

/**
 * Write the generated Kong config to the shared volumes directory
 * and reload Kong without restarting the container.
 */
export async function writeKongConfig(config: string, sharedDir: string): Promise<void> {
  const kongConfigPath = path.join(sharedDir, 'volumes', 'api', 'kong.yml');

  // Backup existing config
  const backupPath = kongConfigPath + '.backup';
  if (fs.existsSync(kongConfigPath)) {
    fs.copyFileSync(kongConfigPath, backupPath);
  }

  // Write new config
  fs.writeFileSync(kongConfigPath, config, 'utf-8');
  logger.info(`Kong config written to ${kongConfigPath}`);
}
