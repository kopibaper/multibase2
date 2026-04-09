/**
 * API Key Scope Definitions
 *
 * All valid scope strings for the system.
 * Format: "<resource>:<action>"
 * Special: "*" = full access to everything
 */

export const SCOPES = {
  INSTANCES: {
    READ: 'instances:read',
    CREATE: 'instances:create',
    UPDATE: 'instances:update',
    DELETE: 'instances:delete',
    START: 'instances:start',
    STOP: 'instances:stop',
    RESTART: 'instances:restart',
  },
  BACKUPS: {
    READ: 'backups:read',
    CREATE: 'backups:create',
    RESTORE: 'backups:restore',
    DELETE: 'backups:delete',
    UPLOAD: 'backups:upload',
  },
  BACKUP_DESTINATIONS: {
    READ: 'backup-destinations:read',
    CREATE: 'backup-destinations:create',
    UPDATE: 'backup-destinations:update',
    DELETE: 'backup-destinations:delete',
    TEST: 'backup-destinations:test',
  },
  METRICS: {
    READ: 'metrics:read',
  },
  LOGS: {
    READ: 'logs:read',
  },
  ALERTS: {
    READ: 'alerts:read',
    CREATE: 'alerts:create',
    UPDATE: 'alerts:update',
    DELETE: 'alerts:delete',
  },
  TEMPLATES: {
    READ: 'templates:read',
    CREATE: 'templates:create',
    UPDATE: 'templates:update',
    DELETE: 'templates:delete',
  },
  SCHEDULES: {
    READ: 'schedules:read',
    CREATE: 'schedules:create',
    UPDATE: 'schedules:update',
    DELETE: 'schedules:delete',
  },
  SETTINGS: {
    READ: 'settings:read',
    WRITE: 'settings:write',
  },
  MIGRATIONS: {
    READ: 'migrations:read',
    RUN: 'migrations:run',
  },
  DEPLOYMENTS: {
    READ: 'deployments:read',
    CREATE: 'deployments:create',
  },
  FUNCTIONS: {
    READ: 'functions:read',
    CREATE: 'functions:create',
    UPDATE: 'functions:update',
    DELETE: 'functions:delete',
  },
  STORAGE: {
    READ: 'storage:read',
    WRITE: 'storage:write',
  },
  ORGS: {
    READ: 'orgs:read',
    CREATE: 'orgs:create',
    UPDATE: 'orgs:update',
    DELETE: 'orgs:delete',
  },
  WEBHOOKS: {
    READ: 'webhooks:read',
    CREATE: 'webhooks:create',
    UPDATE: 'webhooks:update',
    DELETE: 'webhooks:delete',
  },
  DOMAINS: {
    READ: 'domains:read',
    CREATE: 'domains:create',
    UPDATE: 'domains:update',
    DELETE: 'domains:delete',
  },
  VAULT: {
    READ: 'vault:read',
    WRITE: 'vault:write',
  },
  SECURITY: {
    READ: 'security:read',
    WRITE: 'security:write',
  },
  CRON: {
    READ: 'cron:read',
    CREATE: 'cron:create',
    UPDATE: 'cron:update',
    DELETE: 'cron:delete',
  },
  VECTORS: {
    READ: 'vectors:read',
    WRITE: 'vectors:write',
  },
  QUEUES: {
    READ: 'queues:read',
    WRITE: 'queues:write',
  },
  REALTIME: {
    READ: 'realtime:read',
    WRITE: 'realtime:write',
  },
  REPLICAS: {
    READ: 'replicas:read',
    CREATE: 'replicas:create',
    DELETE: 'replicas:delete',
  },
  LOG_DRAINS: {
    READ: 'log-drains:read',
    CREATE: 'log-drains:create',
    UPDATE: 'log-drains:update',
    DELETE: 'log-drains:delete',
  },
  MCP: {
    READ: 'mcp:read',
    WRITE: 'mcp:write',
  },
  STUDIO: {
    READ: 'studio:read',
    WRITE: 'studio:write',
  },
  MARKETPLACE: {
    READ: 'marketplace:read',
    WRITE: 'marketplace:write',
  },
  EXTENSIONS: {
    READ: 'extensions:read',
    CREATE: 'extensions:create',
    DELETE: 'extensions:delete',
  },
  AI_AGENT: {
    READ: 'ai-agent:read',
    USE: 'ai-agent:use',
  },
  AUDIT: {
    READ: 'audit:read',
  },
  NOTIFICATIONS: {
    READ: 'notifications:read',
    WRITE: 'notifications:write',
  },
  UPTIME: {
    READ: 'uptime:read',
  },
  KEYS: {
    READ: 'keys:read',
    CREATE: 'keys:create',
    DELETE: 'keys:delete',
  },
} as const;

// Flat array of all valid scope strings (excluding '*')
export const ALL_SCOPES = Object.values(SCOPES).flatMap((group) =>
  Object.values(group)
) as string[];

// TypeScript union type of all valid scope strings
type ScopeValues<T> = T extends Record<string, infer V> ? V : never;
export type Scope = ScopeValues<(typeof SCOPES)[keyof typeof SCOPES]> | '*';

/**
 * Grouped scope data for API responses and frontend consumption
 */
export const SCOPE_GROUPS: Array<{ group: string; label: string; scopes: string[] }> = [
  { group: 'instances', label: 'Instances', scopes: Object.values(SCOPES.INSTANCES) },
  { group: 'backups', label: 'Backups', scopes: Object.values(SCOPES.BACKUPS) },
  { group: 'backup-destinations', label: 'Backup Destinations', scopes: Object.values(SCOPES.BACKUP_DESTINATIONS) },
  { group: 'metrics', label: 'Metrics', scopes: Object.values(SCOPES.METRICS) },
  { group: 'logs', label: 'Logs', scopes: Object.values(SCOPES.LOGS) },
  { group: 'alerts', label: 'Alerts', scopes: Object.values(SCOPES.ALERTS) },
  { group: 'templates', label: 'Templates', scopes: Object.values(SCOPES.TEMPLATES) },
  { group: 'schedules', label: 'Schedules', scopes: Object.values(SCOPES.SCHEDULES) },
  { group: 'settings', label: 'Settings', scopes: Object.values(SCOPES.SETTINGS) },
  { group: 'migrations', label: 'Migrations', scopes: Object.values(SCOPES.MIGRATIONS) },
  { group: 'deployments', label: 'Deployments', scopes: Object.values(SCOPES.DEPLOYMENTS) },
  { group: 'functions', label: 'Functions', scopes: Object.values(SCOPES.FUNCTIONS) },
  { group: 'storage', label: 'Storage', scopes: Object.values(SCOPES.STORAGE) },
  { group: 'orgs', label: 'Organisations', scopes: Object.values(SCOPES.ORGS) },
  { group: 'webhooks', label: 'Webhooks', scopes: Object.values(SCOPES.WEBHOOKS) },
  { group: 'domains', label: 'Domains', scopes: Object.values(SCOPES.DOMAINS) },
  { group: 'vault', label: 'Vault / Secrets', scopes: Object.values(SCOPES.VAULT) },
  { group: 'security', label: 'Security', scopes: Object.values(SCOPES.SECURITY) },
  { group: 'cron', label: 'Cron Jobs', scopes: Object.values(SCOPES.CRON) },
  { group: 'vectors', label: 'Vectors / AI', scopes: Object.values(SCOPES.VECTORS) },
  { group: 'queues', label: 'Queues', scopes: Object.values(SCOPES.QUEUES) },
  { group: 'realtime', label: 'Realtime', scopes: Object.values(SCOPES.REALTIME) },
  { group: 'replicas', label: 'Replicas', scopes: Object.values(SCOPES.REPLICAS) },
  { group: 'log-drains', label: 'Log Drains', scopes: Object.values(SCOPES.LOG_DRAINS) },
  { group: 'mcp', label: 'MCP', scopes: Object.values(SCOPES.MCP) },
  { group: 'marketplace', label: 'Marketplace', scopes: Object.values(SCOPES.MARKETPLACE) },
  { group: 'extensions', label: 'Extensions', scopes: Object.values(SCOPES.EXTENSIONS) },
  { group: 'ai-agent', label: 'AI Agent', scopes: Object.values(SCOPES.AI_AGENT) },
  { group: 'audit', label: 'Audit Log', scopes: Object.values(SCOPES.AUDIT) },
  { group: 'notifications', label: 'Notifications', scopes: Object.values(SCOPES.NOTIFICATIONS) },
  { group: 'uptime', label: 'Uptime', scopes: Object.values(SCOPES.UPTIME) },
  { group: 'keys', label: 'API Keys', scopes: Object.values(SCOPES.KEYS) },
];
