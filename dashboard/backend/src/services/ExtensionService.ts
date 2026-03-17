import { PrismaClient } from '@prisma/client';
import InstanceManager from './InstanceManager';
import { RedisCache } from './RedisCache';
import { FunctionService } from './FunctionService';
import { logger } from '../utils/logger';

// ─── Manifest Types ─────────────────────────────────────────────────────────

interface ManifestStep {
  label: string;
  file: string;
  optional?: boolean;
  functionName?: string;
  envVars?: Record<string, string>;
}

interface ConfigSchemaField {
  type: 'string' | 'boolean' | 'number';
  default: unknown;
  label: string;
  description?: string;
}

interface ExtensionManifest {
  id: string;
  version: string;
  requirements?: {
    postgresExtensions?: string[];
  };
  install: {
    type: 'sql' | 'function' | 'config' | 'composite';
    steps: ManifestStep[];
    rollback?: string;
    configSchema?: Record<string, ConfigSchemaField>;
  };
}

// ─── Blocked SQL tokens (security) ──────────────────────────────────────────

const BLOCKED_SQL_PATTERNS = [
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+ROLE\b/i,
  /\bCREATE\s+ROLE\b/i,
  /\bALTER\s+SYSTEM\b/i,
  /\bCOPY\s+.+\s+(TO|FROM)\s+/i,
];

function assertSqlSafe(sql: string): void {
  for (const pattern of BLOCKED_SQL_PATTERNS) {
    if (pattern.test(sql)) {
      throw new Error(`SQL contains a forbidden statement matching: ${pattern}`);
    }
  }
}

// ─── Manifest URL allow-list (SSRF prevention) ──────────────────────────────

const ALLOWED_MANIFEST_HOSTS = [
  'cdn.multibase.dev',
  'registry.multibase.dev',
  'localhost',
  '127.0.0.1',
];

function assertAllowedUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid manifest URL: ${url}`);
  }
  const isAllowed = ALLOWED_MANIFEST_HOSTS.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
  );
  if (!isAllowed) {
    throw new Error(
      `Manifest URL host "${parsed.hostname}" is not on the allow-list. Allowed: ${ALLOWED_MANIFEST_HOSTS.join(', ')}`
    );
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ExtensionService {
  constructor(
    private prisma: PrismaClient,
    private instanceManager: InstanceManager,
    private cache?: RedisCache,
    private functionService?: FunctionService
  ) {}

  /**
   * Install an extension onto an instance.
   * Runs every manifest step in order against the instance's Postgres.
   */
  async install(
    instanceName: string,
    extensionId: string,
    config: Record<string, unknown> = {}
  ): Promise<void> {
    const extension = await this.prisma.extension.findUnique({ where: { id: extensionId } });
    if (!extension) throw new Error(`Extension "${extensionId}" not found`);

    // Resolve instance ID first (needed for duplicate check + upsert)
    const instance = await this.prisma.instance.findUnique({ where: { name: instanceName } });
    if (!instance) throw new Error(`Instance "${instanceName}" not found`);

    // Check for duplicate installation
    const existing = await this.prisma.installedExtension.findUnique({
      where: { instanceId_extensionId: { instanceId: instance.id, extensionId } },
    });
    if (existing && existing.status === 'active') {
      throw new Error(`Extension "${extensionId}" is already installed on "${instanceName}"`);
    }

    // Validate config schema
    const manifest = await this.loadManifest(extension.manifestUrl);
    this.validateConfig(manifest.install.configSchema ?? {}, config);

    // Ensure required postgres extensions
    if (manifest.requirements?.postgresExtensions?.length) {
      await this.ensurePostgresExtensions(instanceName, manifest.requirements.postgresExtensions);
    }

    // Upsert an "installing" record so we can track status

    const installRecord = await this.prisma.installedExtension.upsert({
      where: { instanceId_extensionId: { instanceId: instance.id, extensionId } },
      create: {
        instanceId: instance.id,
        extensionId,
        version: extension.version,
        status: 'updating',
        config: JSON.stringify(config),
      },
      update: { status: 'updating', config: JSON.stringify(config), version: extension.version },
    });

    try {
      for (const step of manifest.install.steps) {
        // Skip optional steps if caller opted out
        if (step.optional && (config as any).skip?.[step.label]) continue;

        switch (manifest.install.type) {
          case 'sql':
          case 'composite': {
            if (step.file) {
              const sql = await this.fetchFile(extension.manifestUrl, step.file);
              const interpolated = this.interpolateConfig(sql, config);
              assertSqlSafe(interpolated);
              await this.instanceManager.executeSQL(instanceName, interpolated);
            }
            break;
          }
          case 'function': {
            if (step.file && step.functionName && this.functionService) {
              const code = await this.fetchFile(extension.manifestUrl, step.file);
              await this.functionService.saveFunction(instanceName, step.functionName, code);
              await this.functionService.deployFunction(instanceName, step.functionName);
            }
            break;
          }
          case 'config': {
            if (step.envVars) {
              await this.instanceManager.updateInstanceEnv(instanceName, step.envVars);
            }
            break;
          }
        }
      }

      // Mark as active and increment install counter
      await this.prisma.$transaction([
        this.prisma.installedExtension.update({
          where: { id: installRecord.id },
          data: { status: 'active' },
        }),
        this.prisma.extension.update({
          where: { id: extensionId },
          data: { installCount: { increment: 1 } },
        }),
      ]);
    } catch (err) {
      await this.prisma.installedExtension.update({
        where: { id: installRecord.id },
        data: { status: 'error' },
      });
      throw err;
    }
  }

  /**
   * Uninstall an extension from an instance (runs rollback.sql if present).
   */
  async uninstall(instanceName: string, extensionId: string): Promise<void> {
    const instance = await this.prisma.instance.findUnique({ where: { name: instanceName } });
    if (!instance) throw new Error(`Instance "${instanceName}" not found`);

    const installed = await this.prisma.installedExtension.findUnique({
      where: { instanceId_extensionId: { instanceId: instance.id, extensionId } },
      include: { extension: true },
    });
    if (!installed) throw new Error(`Extension "${extensionId}" is not installed on "${instanceName}"`);

    try {
      const manifest = await this.loadManifest(installed.extension.manifestUrl);
      if (manifest.install.rollback) {
        const rollbackSql = await this.fetchFile(installed.extension.manifestUrl, manifest.install.rollback);
        assertSqlSafe(rollbackSql);
        await this.instanceManager.executeSQL(instanceName, rollbackSql);
      }
    } catch (err) {
      logger.warn(`Rollback manifest unavailable for ${extensionId} — skipping rollback SQL: ${(err as Error).message}`);
    }

    await this.prisma.installedExtension.delete({ where: { id: installed.id } });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private validateConfig(
    schema: Record<string, ConfigSchemaField>,
    config: Record<string, unknown>
  ): void {
    for (const [key, field] of Object.entries(schema)) {
      const value = key in config ? config[key] : field.default;
      if (value === undefined || value === null) continue;
      if (field.type === 'boolean' && typeof value !== 'boolean') {
        throw new Error(`Config field "${key}" must be a boolean`);
      }
      if (field.type === 'number' && typeof value !== 'number') {
        throw new Error(`Config field "${key}" must be a number`);
      }
      if (field.type === 'string' && typeof value !== 'string') {
        throw new Error(`Config field "${key}" must be a string`);
      }
    }
  }

  private async ensurePostgresExtensions(instanceName: string, extensions: string[]): Promise<void> {
    for (const ext of extensions) {
      // Sanitize: only allow alphanumeric + underscore/hyphen extension names
      if (!/^[\w-]+$/.test(ext)) {
        throw new Error(`Invalid postgres extension name: "${ext}"`);
      }
      await this.instanceManager.executeSQL(
        instanceName,
        `CREATE EXTENSION IF NOT EXISTS "${ext}";`
      );
    }
  }

  private interpolateConfig(template: string, config: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = config[key];
      return val !== undefined ? String(val) : '';
    });
  }

  /**
   * Load and cache extension manifest (1-hour TTL in Redis if available).
   */
  async loadManifest(manifestUrl: string): Promise<ExtensionManifest> {
    assertAllowedUrl(manifestUrl);

    const cacheKey = `manifest:${manifestUrl}`;

    if (this.cache) {
      try {
        const cached = await this.cache.get(cacheKey);
        if (cached) return JSON.parse(cached) as ExtensionManifest;
      } catch {
        // Cache miss — continue to fetch
      }
    }

    try {
      const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const manifest = (await response.json()) as ExtensionManifest;

      if (this.cache) {
        try {
          await this.cache.set(cacheKey, JSON.stringify(manifest), 3600);
        } catch {
          // Non-fatal cache write failure
        }
      }

      return manifest;
    } catch (err) {
      // Registry not reachable — return a no-op manifest so installation can
      // still proceed (creates the InstalledExtension record without running
      // any SQL/function steps). This is expected during local development.
      logger.warn(`Manifest fetch failed for ${manifestUrl} — using no-op fallback: ${(err as Error).message}`);
      const idMatch = manifestUrl.match(/extensions\/([^/]+)\//);
      return {
        id: idMatch?.[1] ?? 'unknown',
        version: '0.0.0',
        install: { type: 'config', steps: [] },
      };
    }
  }

  /**
   * Fetch a file relative to the manifest URL's base path.
   */
  private async fetchFile(manifestUrl: string, filePath: string): Promise<string> {
    assertAllowedUrl(manifestUrl);
    const base = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);
    const fileUrl = new URL(filePath, base).toString();
    assertAllowedUrl(fileUrl);

    const response = await fetch(fileUrl, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch file "${filePath}": HTTP ${response.status}`);
    }
    return response.text();
  }
}
