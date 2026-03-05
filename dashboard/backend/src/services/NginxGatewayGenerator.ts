/**
 * NginxGatewayGenerator - Generates dynamic Nginx configs for the shared
 * nginx-gateway container, replacing per-tenant Kong containers.
 *
 * Each tenant gets a dedicated config file under shared/volumes/nginx/tenants/{tenant}.conf
 * with port-based routing (each tenant keeps their assigned gateway port).
 *
 * After writing configs, the Nginx gateway is reloaded (~50ms, zero-downtime).
 */

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { parseEnvFile } from '../utils/envParser';

const execAsync = promisify(exec);

export interface NginxGatewayOptions {
  /** Tenant name, e.g. "cloud-test" */
  tenantName: string;
  /** Anon key for API key validation */
  anonKey: string;
  /** Service role key for admin routes */
  serviceRoleKey: string;
  /** Gateway port (replaces kong_http port) */
  gatewayPort: number;
}

/**
 * Read the gateway template and replace placeholders with tenant-specific values.
 */
export function generateNginxGatewayConfig(options: NginxGatewayOptions): string {
  const { tenantName, anonKey, serviceRoleKey, gatewayPort } = options;

  // Resolve template path (works from both dist/ and src/)
  const possiblePaths = [
    path.resolve(__dirname, '..', '..', '..', '..', 'templates', 'nginx', 'gateway.conf.template'),
    path.resolve(__dirname, '..', '..', '..', 'templates', 'nginx', 'gateway.conf.template'),
  ];

  let templateContent = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      templateContent = fs.readFileSync(p, 'utf-8');
      break;
    }
  }

  if (!templateContent) {
    throw new Error(`Nginx gateway template not found. Searched: ${possiblePaths.join(', ')}`);
  }

  // Create a safe identifier for map variable names (no hyphens allowed in nginx vars)
  const tenantId = tenantName.replace(/-/g, '_');

  const config = templateContent
    .replace(/\{\{TENANT_NAME\}\}/g, tenantName)
    .replace(/\{\{TENANT_ID\}\}/g, tenantId)
    .replace(/\{\{ANON_KEY\}\}/g, anonKey)
    .replace(/\{\{SERVICE_ROLE_KEY\}\}/g, serviceRoleKey)
    .replace(/\{\{GATEWAY_PORT\}\}/g, String(gatewayPort))
    .replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());

  return config;
}

/**
 * Generate a tenant config from its .env file and write to the nginx tenants directory.
 */
export async function generateAndWriteTenantConfig(
  tenantName: string,
  projectsDir: string,
  sharedDir: string
): Promise<string> {
  const tenantEnvPath = path.join(projectsDir, tenantName, '.env');
  if (!fs.existsSync(tenantEnvPath)) {
    throw new Error(`Tenant .env not found: ${tenantEnvPath}`);
  }

  const tenantEnv = parseEnvFile(tenantEnvPath);
  const sharedEnvPath = path.join(sharedDir, '.env.shared');
  const sharedEnv = fs.existsSync(sharedEnvPath) ? parseEnvFile(sharedEnvPath) : {};

  const anonKey = tenantEnv['ANON_KEY'] || sharedEnv['SHARED_ANON_KEY'] || '';
  const serviceRoleKey =
    tenantEnv['SERVICE_ROLE_KEY'] || sharedEnv['SHARED_SERVICE_ROLE_KEY'] || '';
  const gatewayPort = parseInt(
    tenantEnv['GATEWAY_PORT'] || tenantEnv['KONG_HTTP_PORT'] || '8000',
    10
  );

  const config = generateNginxGatewayConfig({
    tenantName,
    anonKey,
    serviceRoleKey,
    gatewayPort,
  });

  const configPath = await writeNginxTenantConfig(tenantName, config, sharedDir);
  return configPath;
}

/**
 * Write a tenant's Nginx config to the shared volumes directory.
 */
export async function writeNginxTenantConfig(
  tenantName: string,
  config: string,
  sharedDir: string
): Promise<string> {
  const tenantsDir = path.join(sharedDir, 'volumes', 'nginx', 'tenants');
  fs.mkdirSync(tenantsDir, { recursive: true });

  const configPath = path.join(tenantsDir, `${tenantName}.conf`);

  // Backup existing config
  if (fs.existsSync(configPath)) {
    const backupPath = `${configPath}.backup`;
    fs.copyFileSync(configPath, backupPath);
  }

  fs.writeFileSync(configPath, config, 'utf-8');
  logger.info(`Nginx gateway config written: ${configPath}`);
  return configPath;
}

/**
 * Remove a tenant's Nginx config (when deleting a tenant).
 */
export async function removeNginxTenantConfig(
  tenantName: string,
  sharedDir: string
): Promise<void> {
  const configPath = path.join(sharedDir, 'volumes', 'nginx', 'tenants', `${tenantName}.conf`);
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
    logger.info(`Removed Nginx config for tenant "${tenantName}"`);
  }
}

/**
 * Reload the Nginx gateway container (zero-downtime, ~50ms).
 * Falls back to container restart if reload fails.
 */
export async function reloadNginxGateway(): Promise<void> {
  try {
    // First validate the config
    const { stderr: testStderr } = await execAsync('docker exec multibase-nginx-gateway nginx -t', {
      timeout: 10000,
    });
    if (testStderr && !testStderr.includes('successful')) {
      logger.warn(`Nginx config test output: ${testStderr}`);
    }

    // Then reload
    await execAsync('docker exec multibase-nginx-gateway nginx -s reload', { timeout: 10000 });
    logger.info('Nginx gateway reloaded successfully');
  } catch (error: any) {
    logger.warn(`Nginx reload failed, attempting container restart: ${error.message}`);
    try {
      await execAsync('docker restart multibase-nginx-gateway', { timeout: 30000 });
      logger.info('Nginx gateway container restarted successfully');
    } catch (restartError: any) {
      throw new Error(`Failed to reload/restart Nginx gateway: ${restartError.message}`);
    }
  }
}

/**
 * Check if the Nginx gateway container is running.
 */
export async function isNginxGatewayRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      "docker inspect --format='{{.State.Running}}' multibase-nginx-gateway",
      { timeout: 5000 }
    );
    return stdout.trim().replace(/'/g, '') === 'true';
  } catch {
    return false;
  }
}

/**
 * Generate configs for ALL existing tenants and reload Nginx.
 * Useful after gateway container restart or initial setup.
 */
export async function regenerateAllTenantConfigs(
  projectsDir: string,
  sharedDir: string
): Promise<string[]> {
  const tenantsDir = path.join(sharedDir, 'volumes', 'nginx', 'tenants');
  fs.mkdirSync(tenantsDir, { recursive: true });

  const generated: string[] = [];

  if (!fs.existsSync(projectsDir)) {
    logger.warn(`Projects directory not found: ${projectsDir}`);
    return generated;
  }

  const tenants = fs.readdirSync(projectsDir).filter((name) => {
    const envPath = path.join(projectsDir, name, '.env');
    return fs.existsSync(envPath) && fs.statSync(path.join(projectsDir, name)).isDirectory();
  });

  for (const tenantName of tenants) {
    try {
      await generateAndWriteTenantConfig(tenantName, projectsDir, sharedDir);
      generated.push(tenantName);
    } catch (error) {
      logger.error(`Failed to generate Nginx config for tenant "${tenantName}":`, error);
    }
  }

  if (generated.length > 0) {
    try {
      await reloadNginxGateway();
    } catch (error) {
      logger.warn('Could not reload Nginx gateway (may not be running yet):', error);
    }
  }

  logger.info(`Generated Nginx configs for ${generated.length} tenants: ${generated.join(', ')}`);
  return generated;
}

/**
 * Get the list of tenants with active Nginx configs.
 */
export function getConfiguredTenants(sharedDir: string): string[] {
  const tenantsDir = path.join(sharedDir, 'volumes', 'nginx', 'tenants');
  if (!fs.existsSync(tenantsDir)) return [];

  return fs
    .readdirSync(tenantsDir)
    .filter((f) => f.endsWith('.conf') && !f.endsWith('.backup'))
    .map((f) => f.replace('.conf', ''));
}
