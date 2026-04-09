import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Book,
  Code,
  Globe,
  Terminal,
  Search,
  Shield,
  Database,
  Server,
  Activity,
  Bell,
  Key,
  Users,
  Settings,
  ChevronDown,
  ChevronRight,
  Cpu,
  Layers,
  Zap,
  Bot,
  HardDrive,
  GitBranch,
  Clock,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Endpoint {
  method: HttpMethod;
  path: string;
  description: string;
  admin?: boolean;
}

interface EndpointGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  endpoints: Endpoint[];
}

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    id: 'auth',
    label: 'Authentication',
    icon: <Shield className='w-4 h-4' />,
    endpoints: [
      { method: 'POST', path: '/api/auth/register', description: 'Register a new user account' },
      { method: 'POST', path: '/api/auth/login', description: 'Login and receive a session token' },
      { method: 'POST', path: '/api/auth/logout', description: 'Invalidate the current session' },
      { method: 'POST', path: '/api/auth/login-2fa', description: 'Complete login with 2FA code (second step)' },
      { method: 'GET', path: '/api/auth/me', description: 'Get the currently authenticated user' },
      { method: 'PUT', path: '/api/auth/profile', description: 'Update own username / email' },
      { method: 'POST', path: '/api/auth/avatar', description: 'Upload a profile avatar image' },
      { method: 'DELETE', path: '/api/auth/avatar', description: 'Remove profile avatar' },
      { method: 'POST', path: '/api/auth/2fa/enable', description: 'Generate 2FA secret and QR code' },
      { method: 'POST', path: '/api/auth/2fa/verify', description: 'Verify code to activate 2FA' },
      { method: 'POST', path: '/api/auth/2fa/disable', description: 'Disable 2FA (requires valid TOTP code)' },
      { method: 'GET', path: '/api/auth/2fa/status', description: 'Check if 2FA is enabled for current user' },
      { method: 'POST', path: '/api/auth/verify-email', description: 'Confirm email address via token' },
      { method: 'POST', path: '/api/auth/forgot-password', description: 'Request a password reset email' },
      { method: 'POST', path: '/api/auth/reset-password', description: 'Reset password using reset token' },
      { method: 'POST', path: '/api/auth/delete-account', description: 'Permanently delete own account' },
      { method: 'GET', path: '/api/auth/users', description: 'List all users', admin: true },
      { method: 'GET', path: '/api/auth/users/:id', description: 'Get user by ID', admin: true },
      { method: 'PATCH', path: '/api/auth/users/:id', description: 'Update user fields (role, status, etc.)', admin: true },
      { method: 'PUT', path: '/api/auth/users/:id', description: 'Full update of a user', admin: true },
      { method: 'PUT', path: '/api/auth/users/:id/password', description: 'Reset another user\'s password', admin: true },
      { method: 'DELETE', path: '/api/auth/users/:id', description: 'Delete a user account', admin: true },
      { method: 'GET', path: '/api/auth/users/:id/sessions', description: 'List active sessions for a user' },
      { method: 'DELETE', path: '/api/auth/users/:id/sessions/:sessionId', description: 'Terminate a specific session' },
      { method: 'DELETE', path: '/api/auth/users/:id/2fa', description: 'Admin reset/disable 2FA for a user', admin: true },
      { method: 'GET', path: '/api/auth/users/:id/2fa', description: 'Check if a user has 2FA enabled', admin: true },
    ],
  },
  {
    id: 'instances',
    label: 'Instances',
    icon: <Server className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/instances', description: 'List all provisioned instances' },
      { method: 'POST', path: '/api/instances', description: 'Create (provision) a new instance' },
      { method: 'GET', path: '/api/instances/:name', description: 'Get details of a single instance' },
      { method: 'DELETE', path: '/api/instances/:name', description: 'Delete (deprovision) an instance' },
      { method: 'POST', path: '/api/instances/:name/start', description: 'Start a stopped instance' },
      { method: 'POST', path: '/api/instances/:name/stop', description: 'Stop a running instance' },
      { method: 'POST', path: '/api/instances/:name/restart', description: 'Restart an instance' },
      { method: 'POST', path: '/api/instances/:name/clone', description: 'Clone an instance to a new one' },
      { method: 'POST', path: '/api/instances/:name/recreate', description: 'Recreate an instance (fresh containers, keep data)' },
      { method: 'POST', path: '/api/instances/bulk', description: 'Perform a bulk action (start/stop/restart) on multiple instances' },
      { method: 'PATCH', path: '/api/instances/:name/config', description: 'Update instance environment / configuration' },
      { method: 'GET', path: '/api/instances/:name/status', description: 'Get container/service status of an instance' },
      { method: 'GET', path: '/api/instances/:name/logs', description: 'Stream or fetch recent logs for an instance' },
      { method: 'POST', path: '/api/instances/:name/assign-org', description: 'Assign an instance to an organisation' },
    ],
  },
  {
    id: 'backups',
    label: 'Backups',
    icon: <HardDrive className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/backups', description: 'List all backups across all instances' },
      { method: 'POST', path: '/api/backups', description: 'Create a manual backup for an instance' },
      { method: 'DELETE', path: '/api/backups/:id', description: 'Delete a backup' },
      { method: 'POST', path: '/api/backups/:id/restore', description: 'Restore an instance from a backup' },
      { method: 'GET', path: '/api/backup-destinations', description: 'List configured external backup destinations' },
      { method: 'POST', path: '/api/backup-destinations', description: 'Add an external destination (S3, SFTP, OneDrive, etc.)' },
      { method: 'GET', path: '/api/backup-destinations/:id', description: 'Get backup destination metadata' },
      { method: 'PUT', path: '/api/backup-destinations/:id', description: 'Update a backup destination' },
      { method: 'DELETE', path: '/api/backup-destinations/:id', description: 'Remove a backup destination' },
      { method: 'POST', path: '/api/backup-destinations/:id/test', description: 'Test connectivity to a backup destination' },
      { method: 'GET', path: '/api/instances/:name/schedules', description: 'List backup schedules for an instance' },
      { method: 'POST', path: '/api/instances/:name/schedules', description: 'Create a backup schedule' },
      { method: 'PUT', path: '/api/instances/:name/schedules/:id', description: 'Update a backup schedule' },
      { method: 'DELETE', path: '/api/instances/:name/schedules/:id', description: 'Delete a backup schedule' },
      { method: 'POST', path: '/api/instances/:name/schedules/:id/run', description: 'Manually trigger a scheduled backup' },
    ],
  },
  {
    id: 'database',
    label: 'Database & Storage',
    icon: <Database className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/instances/:name/vault', description: 'List vault secrets (names only, no values)' },
      { method: 'POST', path: '/api/instances/:name/vault', description: 'Create a new vault secret' },
      { method: 'GET', path: '/api/instances/:name/vault/:id/reveal', description: 'Decrypt and return a secret value' },
      { method: 'PATCH', path: '/api/instances/:name/vault/:id', description: 'Update a secret\'s value' },
      { method: 'DELETE', path: '/api/instances/:name/vault/:id', description: 'Delete a secret' },
      { method: 'GET', path: '/api/instances/:name/storage/buckets', description: 'List storage buckets' },
      { method: 'POST', path: '/api/instances/:name/storage/buckets', description: 'Create a storage bucket' },
      { method: 'DELETE', path: '/api/instances/:name/storage/buckets/:bucketId', description: 'Delete a storage bucket' },
      { method: 'GET', path: '/api/instances/:name/storage/files/:bucketId/:path?', description: 'List files in a bucket/folder' },
      { method: 'POST', path: '/api/instances/:name/storage/files/:bucketId', description: 'Upload a file to a bucket' },
      { method: 'DELETE', path: '/api/instances/:name/storage/files/:bucketId/:path', description: 'Delete a file' },
      { method: 'GET', path: '/api/instances/:name/storage/url/:bucketId/:path', description: 'Get a public URL for a file' },
      { method: 'POST', path: '/api/instances/:name/storage/signed-url/:bucketId', description: 'Create a signed (temporary) URL' },
      { method: 'POST', path: '/api/instances/:name/storage/cache/invalidate', description: 'Invalidate CDN cache (reloads nginx)' },
      { method: 'GET', path: '/api/instances/:name/vectors/status', description: 'Get pgvector extension status' },
      { method: 'POST', path: '/api/instances/:name/vectors/enable', description: 'Enable the pgvector extension' },
      { method: 'GET', path: '/api/instances/:name/vectors/columns', description: 'List vector columns' },
      { method: 'POST', path: '/api/instances/:name/vectors/columns', description: 'Add a vector column to a table' },
      { method: 'GET', path: '/api/instances/:name/vectors/indexes', description: 'List vector indexes' },
      { method: 'POST', path: '/api/instances/:name/vectors/indexes', description: 'Create a vector index' },
      { method: 'DELETE', path: '/api/instances/:name/vectors/indexes/:indexName', description: 'Drop a vector index' },
      { method: 'POST', path: '/api/instances/:name/vectors/search', description: 'Perform a similarity (vector) search' },
      { method: 'GET', path: '/api/instances/:name/migrations', description: 'List database migrations' },
      { method: 'POST', path: '/api/instances/:name/migrations', description: 'Run pending migrations' },
      { method: 'POST', path: '/api/instances/:name/sql', description: 'Execute raw SQL against an instance' },
    ],
  },
  {
    id: 'networking',
    label: 'Networking & Security',
    icon: <Globe className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/instances/:name/domains', description: 'List custom domains for an instance' },
      { method: 'POST', path: '/api/instances/:name/domains', description: 'Add a custom domain' },
      { method: 'DELETE', path: '/api/instances/:name/domains/:domain', description: 'Remove a custom domain' },
      { method: 'POST', path: '/api/instances/:name/domains/:domain/check-dns', description: 'Check DNS propagation for a domain' },
      { method: 'POST', path: '/api/instances/:name/domains/:domain/activate-ssl', description: 'Issue SSL certificate via Certbot' },
      { method: 'POST', path: '/api/instances/:name/domains/:domain/manual-activate', description: 'Manually activate SSL after cert is placed' },
      { method: 'GET', path: '/api/instances/:name/security', description: 'Get security settings (IP whitelist, rate limit, SSL)' },
      { method: 'PATCH', path: '/api/instances/:name/security', description: 'Update security settings' },
      { method: 'GET', path: '/api/instances/:name/webhooks', description: 'List webhooks for an instance' },
      { method: 'POST', path: '/api/instances/:name/webhooks', description: 'Create a webhook' },
      { method: 'PATCH', path: '/api/instances/:name/webhooks/:webhookId', description: 'Enable or disable a webhook' },
      { method: 'DELETE', path: '/api/instances/:name/webhooks/:webhookId', description: 'Delete a webhook' },
      { method: 'GET', path: '/api/instances/:name/replicas', description: 'List read replicas' },
      { method: 'POST', path: '/api/instances/:name/replicas', description: 'Register a read replica' },
      { method: 'GET', path: '/api/instances/:name/replicas/:id/status', description: 'Get replica lag and connection status' },
      { method: 'DELETE', path: '/api/instances/:name/replicas/:id', description: 'Remove a read replica' },
      { method: 'GET', path: '/api/instances/:name/realtime/config', description: 'Get realtime service config and status' },
      { method: 'PATCH', path: '/api/instances/:name/realtime/config', description: 'Update realtime config and restart container' },
      { method: 'GET', path: '/api/instances/:name/realtime/stats', description: 'Get realtime channel count and container stats' },
    ],
  },
  {
    id: 'automation',
    label: 'Automation & Functions',
    icon: <Zap className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/instances/:name/cron/status', description: 'Get pg_cron extension status' },
      { method: 'GET', path: '/api/instances/:name/cron', description: 'List cron jobs' },
      { method: 'POST', path: '/api/instances/:name/cron', description: 'Create a cron job' },
      { method: 'PATCH', path: '/api/instances/:name/cron/:jobId', description: 'Toggle a cron job active / inactive' },
      { method: 'DELETE', path: '/api/instances/:name/cron/:jobId', description: 'Delete a cron job' },
      { method: 'POST', path: '/api/instances/:name/cron/:jobId/run', description: 'Run a cron job immediately' },
      { method: 'GET', path: '/api/instances/:name/cron/:jobId/runs', description: 'Get run history for a cron job' },
      { method: 'GET', path: '/api/instances/:name/functions', description: 'List edge functions' },
      { method: 'GET', path: '/api/instances/:name/functions/:functionName', description: 'Get function source code' },
      { method: 'PUT', path: '/api/instances/:name/functions/:functionName', description: 'Save / update function code' },
      { method: 'DELETE', path: '/api/instances/:name/functions/:functionName', description: 'Delete a function' },
      { method: 'POST', path: '/api/instances/:name/functions/:functionName/deploy', description: 'Deploy a function' },
      { method: 'GET', path: '/api/instances/:name/functions/:functionName/logs', description: 'Get function execution logs' },
      { method: 'GET', path: '/api/instances/:name/functions/:functionName/env', description: 'Get function environment variables' },
      { method: 'PUT', path: '/api/instances/:name/functions/:functionName/env', description: 'Save function environment variables' },
      { method: 'POST', path: '/api/instances/:name/functions/:functionName/invoke', description: 'Invoke / test a function' },
      { method: 'GET', path: '/api/instances/:name/queues/status', description: 'Get pgmq extension status' },
      { method: 'POST', path: '/api/instances/:name/queues/enable', description: 'Enable the pgmq extension' },
      { method: 'GET', path: '/api/instances/:name/queues', description: 'List queues' },
      { method: 'POST', path: '/api/instances/:name/queues', description: 'Create a queue' },
      { method: 'DELETE', path: '/api/instances/:name/queues/:queueName', description: 'Drop a queue' },
      { method: 'GET', path: '/api/instances/:name/queues/:queueName/messages', description: 'Read messages from a queue' },
      { method: 'POST', path: '/api/instances/:name/queues/:queueName/send', description: 'Send a message to a queue' },
      { method: 'POST', path: '/api/instances/:name/queues/:queueName/purge', description: 'Purge all messages from a queue' },
      { method: 'GET', path: '/api/instances/:name/queues/:queueName/metrics', description: 'Get queue metrics' },
    ],
  },
  {
    id: 'monitoring',
    label: 'Monitoring & Logs',
    icon: <Activity className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/instances/:name/metrics', description: 'Get CPU, memory, disk and network metrics' },
      { method: 'GET', path: '/api/instances/:name/uptime', description: 'Get uptime history and current status' },
      { method: 'GET', path: '/api/instances/:name/logs', description: 'Fetch or stream container logs' },
      { method: 'GET', path: '/api/instances/:name/log-drains', description: 'List log drains for an instance' },
      { method: 'POST', path: '/api/instances/:name/log-drains', description: 'Create a log drain' },
      { method: 'PATCH', path: '/api/instances/:name/log-drains/:id', description: 'Update a log drain' },
      { method: 'POST', path: '/api/instances/:name/log-drains/:id/test', description: 'Test log drain delivery' },
      { method: 'DELETE', path: '/api/instances/:name/log-drains/:id', description: 'Delete a log drain' },
      { method: 'GET', path: '/api/alerts', description: 'List all active alerts', admin: true },
      { method: 'GET', path: '/api/alerts/rules', description: 'List all alert rules', admin: true },
      { method: 'POST', path: '/api/alerts/rules', description: 'Create an alert rule', admin: true },
      { method: 'PUT', path: '/api/alerts/rules/:id', description: 'Update an alert rule', admin: true },
      { method: 'DELETE', path: '/api/alerts/rules/:id', description: 'Delete an alert rule', admin: true },
      { method: 'POST', path: '/api/alerts/:id/acknowledge', description: 'Acknowledge an alert', admin: true },
      { method: 'POST', path: '/api/alerts/:id/resolve', description: 'Resolve an alert', admin: true },
      { method: 'POST', path: '/api/alerts/check', description: 'Manually trigger alert evaluation', admin: true },
      { method: 'GET', path: '/api/audit', description: 'List audit logs with filtering and sorting', admin: true },
      { method: 'GET', path: '/api/audit/stats', description: 'Get audit log statistics (totals, success rate)', admin: true },
      { method: 'GET', path: '/api/audit/actions', description: 'Get distinct action types with counts', admin: true },
      { method: 'GET', path: '/api/audit/:id', description: 'Get a single audit log entry', admin: true },
    ],
  },
  {
    id: 'deployments',
    label: 'Deployments',
    icon: <GitBranch className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/deployments', description: 'List deployments across all instances' },
      { method: 'GET', path: '/api/deployments/:name', description: 'Get deployment history for an instance' },
      { method: 'POST', path: '/api/deployments/:name/trigger', description: 'Manually trigger a deployment' },
      { method: 'POST', path: '/api/deployments/:name/rollback', description: 'Roll back to a previous deployment' },
    ],
  },
  {
    id: 'organizations',
    label: 'Organizations',
    icon: <Users className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/orgs', description: 'List all organizations', admin: true },
      { method: 'POST', path: '/api/orgs', description: 'Create an organization', admin: true },
      { method: 'GET', path: '/api/orgs/:id', description: 'Get organization details', admin: true },
      { method: 'PUT', path: '/api/orgs/:id', description: 'Update an organization', admin: true },
      { method: 'DELETE', path: '/api/orgs/:id', description: 'Delete an organization', admin: true },
      { method: 'GET', path: '/api/orgs/:id/members', description: 'List organization members', admin: true },
      { method: 'POST', path: '/api/orgs/:id/members', description: 'Add a member to an organization', admin: true },
      { method: 'DELETE', path: '/api/orgs/:id/members/:userId', description: 'Remove a member from an organization', admin: true },
    ],
  },
  {
    id: 'system',
    label: 'System & Settings',
    icon: <Settings className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/settings', description: 'Get global system settings (SMTP, etc.)', admin: true },
      { method: 'PATCH', path: '/api/settings', description: 'Update global system settings', admin: true },
      { method: 'POST', path: '/api/settings/smtp/test', description: 'Send a test email via configured SMTP', admin: true },
      { method: 'GET', path: '/api/templates', description: 'List instance templates', admin: true },
      { method: 'POST', path: '/api/templates', description: 'Create an instance template', admin: true },
      { method: 'PUT', path: '/api/templates/:id', description: 'Update a template', admin: true },
      { method: 'DELETE', path: '/api/templates/:id', description: 'Delete a template', admin: true },
      { method: 'GET', path: '/api/notifications', description: 'List notification channels', admin: true },
      { method: 'POST', path: '/api/notifications', description: 'Create a notification channel', admin: true },
      { method: 'PUT', path: '/api/notifications/:id', description: 'Update a notification channel', admin: true },
      { method: 'DELETE', path: '/api/notifications/:id', description: 'Delete a notification channel', admin: true },
      { method: 'POST', path: '/api/notifications/:id/test', description: 'Send a test notification', admin: true },
      { method: 'GET', path: '/api/marketplace', description: 'List available marketplace extensions' },
      { method: 'GET', path: '/api/instances/:name/extensions', description: 'List installed extensions for an instance' },
      { method: 'POST', path: '/api/instances/:name/extensions/install', description: 'Install a marketplace extension' },
      { method: 'DELETE', path: '/api/instances/:name/extensions/:id', description: 'Uninstall an extension' },
      { method: 'GET', path: '/api/shared/status', description: 'Get shared infrastructure status', admin: true },
      { method: 'POST', path: '/api/shared/start', description: 'Start shared infrastructure (Docker Compose)', admin: true },
      { method: 'POST', path: '/api/shared/stop', description: 'Stop shared infrastructure', admin: true },
      { method: 'GET', path: '/api/shared/databases', description: 'List project databases in shared cluster', admin: true },
      { method: 'POST', path: '/api/shared/databases', description: 'Create a project database', admin: true },
      { method: 'DELETE', path: '/api/shared/databases/:name', description: 'Drop a project database', admin: true },
      { method: 'GET', path: '/api/health', description: 'Health check endpoint (public)' },
      { method: 'POST', path: '/api/health/refresh', description: 'Force a health status refresh' },
    ],
  },
  {
    id: 'apikeys',
    label: 'API Keys',
    icon: <Key className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/keys', description: 'List your API keys' },
      { method: 'POST', path: '/api/keys', description: 'Create a new API key' },
      { method: 'DELETE', path: '/api/keys/:id', description: 'Revoke an API key' },
    ],
  },
  {
    id: 'ai',
    label: 'AI Assistant',
    icon: <Bot className='w-4 h-4' />,
    endpoints: [
      { method: 'GET', path: '/api/ai-agent/api-key/status', description: 'Check if an AI API key is configured' },
      { method: 'PUT', path: '/api/ai-agent/api-key', description: 'Save AI provider and API key' },
      { method: 'DELETE', path: '/api/ai-agent/api-key', description: 'Remove the configured AI API key' },
      { method: 'GET', path: '/api/ai-agent/models', description: 'Get available models for the configured provider' },
      { method: 'GET', path: '/api/ai-agent/sessions', description: 'List chat sessions' },
      { method: 'POST', path: '/api/ai-agent/sessions', description: 'Create a new chat session' },
      { method: 'GET', path: '/api/ai-agent/sessions/:id', description: 'Get a session with its message history' },
      { method: 'DELETE', path: '/api/ai-agent/sessions/:id', description: 'Delete a chat session' },
      { method: 'POST', path: '/api/ai-agent/chat', description: 'Send a message and receive a streaming (SSE) response' },
      { method: 'POST', path: '/api/ai-agent/confirm-tool', description: 'Confirm and execute a single destructive AI tool call' },
      { method: 'POST', path: '/api/ai-agent/confirm-tools', description: 'Confirm and execute multiple AI tool calls at once' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    icon: <Layers className='w-4 h-4' />,
    endpoints: [
      { method: 'POST', path: '/api/studio/activate/:tenantName', description: 'Switch the shared Supabase Studio to a tenant' },
      { method: 'GET', path: '/api/studio/active', description: 'Get the currently active Studio tenant' },
      { method: 'POST', path: '/api/studio/deactivate', description: 'Deactivate the current Studio tenant' },
      { method: 'POST', path: '/api/studio/heartbeat/:tenantName', description: 'Reset the idle timer while Studio is open' },
    ],
  },
];

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  POST: 'bg-green-500/15 text-green-400 border border-green-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  PATCH: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  DELETE: 'bg-red-500/15 text-red-400 border border-red-500/30',
};

const curlExample = `# List all instances
curl -X GET https://your-host/api/instances \\
  -H "X-API-Key: mb_your_api_key_here"

# Create a new instance
curl -X POST https://your-host/api/instances \\
  -H "X-API-Key: mb_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "my-project", "template": "default"}'

# Start an instance
curl -X POST https://your-host/api/instances/my-project/start \\
  -H "X-API-Key: mb_your_api_key_here"`;

const nodeExample = `import axios from 'axios';

const client = axios.create({
  baseURL: 'https://your-host/api',
  headers: { 'X-API-Key': 'mb_your_api_key_here' },
});

// List instances
const { data } = await client.get('/instances');
console.log(data);

// Create instance
const { data: instance } = await client.post('/instances', {
  name: 'my-project',
  template: 'default',
});`;

const pythonExample = `import requests

BASE_URL = 'https://your-host/api'
HEADERS = {'X-API-Key': 'mb_your_api_key_here'}

# List instances
resp = requests.get(f'{BASE_URL}/instances', headers=HEADERS)
instances = resp.json()

# Start instance
resp = requests.post(
    f'{BASE_URL}/instances/my-project/start',
    headers=HEADERS
)
print(resp.json())`;

function EndpointRow({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className='flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0 group hover:bg-muted/30 px-3 -mx-3 rounded transition-colors'>
      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${METHOD_STYLES[endpoint.method]}`}>
        {endpoint.method}
      </span>
      <div className='min-w-0 flex-1'>
        <code className='text-xs font-mono text-foreground break-all'>{endpoint.path}</code>
        <p className='text-xs text-muted-foreground mt-0.5'>{endpoint.description}</p>
      </div>
      {endpoint.admin && (
        <span className='text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 shrink-0 mt-0.5'>
          Admin
        </span>
      )}
    </div>
  );
}

function GroupSection({ group }: { group: EndpointGroup }) {
  const [open, setOpen] = useState(true);
  return (
    <div className='bg-card border border-border rounded-lg overflow-hidden'>
      <button
        onClick={() => setOpen((o) => !o)}
        className='w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors'
      >
        <div className='flex items-center gap-2 font-medium text-sm'>
          <span className='text-muted-foreground'>{group.icon}</span>
          {group.label}
          <span className='text-xs text-muted-foreground font-normal'>({group.endpoints.length})</span>
        </div>
        {open ? <ChevronDown className='w-4 h-4 text-muted-foreground' /> : <ChevronRight className='w-4 h-4 text-muted-foreground' />}
      </button>
      {open && (
        <div className='px-4 pb-3 border-t border-border/50'>
          {group.endpoints.map((ep, i) => (
            <EndpointRow key={i} endpoint={ep} />
          ))}
        </div>
      )}
    </div>
  );
}

type Tab = 'overview' | 'endpoints' | 'examples';

export default function ApiDocs() {
  const [tab, setTab] = useState<Tab>('endpoints');
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const totalEndpoints = ENDPOINT_GROUPS.reduce((sum, g) => sum + g.endpoints.length, 0);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ENDPOINT_GROUPS.map((group) => ({
      ...group,
      endpoints: group.endpoints.filter(
        (ep) =>
          (!q || ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q) || ep.method.toLowerCase().includes(q)) &&
          (!activeGroup || group.id === activeGroup)
      ),
    })).filter((g) => g.endpoints.length > 0);
  }, [search, activeGroup]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Globe className='w-4 h-4' /> },
    { id: 'endpoints', label: `Endpoints (${totalEndpoints})`, icon: <Code className='w-4 h-4' /> },
    { id: 'examples', label: 'Code Examples', icon: <Terminal className='w-4 h-4' /> },
  ];

  return (
    <div className='min-h-screen bg-background'>
      <PageHeader>
        <div className='flex items-center justify-between'>
          <div>
            <Link
              to='/api-keys'
              className='inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-2'
            >
              <ArrowLeft className='w-4 h-4' />
              Back to API Keys
            </Link>
            <h2 className='text-2xl font-bold text-foreground flex items-center gap-2'>
              <Book className='w-6 h-6' />
              API Documentation
            </h2>
            <p className='text-muted-foreground mt-1'>
              Complete reference for all {totalEndpoints} Multibase API endpoints.
            </p>
          </div>
        </div>
      </PageHeader>

      <main className='container mx-auto px-6 py-8'>
        {/* Tabs */}
        <div className='flex gap-1 bg-muted/50 rounded-lg p-1 w-fit mb-8'>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
            <div className='lg:col-span-2 space-y-6'>
              <section className='bg-card border rounded-lg p-6'>
                <h3 className='text-lg font-bold mb-4 flex items-center gap-2'>
                  <Globe className='w-5 h-5 text-primary' />
                  Base URL
                </h3>
                <p className='text-muted-foreground mb-3 text-sm'>
                  All API endpoints are relative to your Multibase host:
                </p>
                <code className='block bg-muted px-4 py-3 rounded-md text-sm font-mono'>
                  https://your-host/api
                </code>
              </section>

              <section className='bg-card border rounded-lg p-6'>
                <h3 className='text-lg font-bold mb-4 flex items-center gap-2'>
                  <Key className='w-5 h-5 text-primary' />
                  Authentication
                </h3>
                <p className='text-muted-foreground mb-4 text-sm'>
                  Include your API key in the{' '}
                  <code className='bg-muted px-1.5 py-0.5 rounded text-foreground'>X-API-Key</code>{' '}
                  header of every request. Keys are created in the dashboard under{' '}
                  <Link to='/api-keys' className='text-primary hover:underline'>API Keys</Link>.
                </p>
                <pre className='bg-muted px-4 py-3 rounded-md text-sm font-mono text-foreground overflow-x-auto'>
                  {`X-API-Key: mb_your_api_key_here`}
                </pre>
                <div className='mt-4 bg-secondary/50 p-4 rounded-md border border-border text-sm'>
                  <ul className='space-y-1 text-muted-foreground list-disc list-inside'>
                    <li>Keys grant full access — never expose them in client-side code.</li>
                    <li>Revoke compromised keys immediately in the dashboard.</li>
                    <li>Requests without a valid key return <code className='text-destructive'>401 Unauthorized</code>.</li>
                    <li>Endpoints marked <span className='text-orange-400'>Admin</span> require an admin account or admin-scoped session.</li>
                  </ul>
                </div>
              </section>

              <section className='bg-card border rounded-lg p-6'>
                <h3 className='text-lg font-bold mb-4 flex items-center gap-2'>
                  <Activity className='w-5 h-5 text-primary' />
                  Responses & Errors
                </h3>
                <div className='space-y-3 text-sm'>
                  {[
                    { code: '200', label: 'OK', desc: 'Request succeeded.' },
                    { code: '201', label: 'Created', desc: 'Resource created successfully.' },
                    { code: '204', label: 'No Content', desc: 'Success, no body returned.' },
                    { code: '400', label: 'Bad Request', desc: 'Invalid input or missing required fields.' },
                    { code: '401', label: 'Unauthorized', desc: 'Missing or invalid API key / session.' },
                    { code: '403', label: 'Forbidden', desc: 'Valid auth but insufficient permissions (admin required).' },
                    { code: '404', label: 'Not Found', desc: 'Resource does not exist.' },
                    { code: '429', label: 'Too Many Requests', desc: 'Rate limit exceeded.' },
                    { code: '500', label: 'Server Error', desc: 'Unexpected server error — check logs.' },
                  ].map(({ code, label, desc }) => (
                    <div key={code} className='flex gap-3'>
                      <code className='shrink-0 w-10 text-foreground font-mono'>{code}</code>
                      <span className='shrink-0 w-32 text-foreground font-medium'>{label}</span>
                      <span className='text-muted-foreground'>{desc}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className='space-y-4'>
              <div className='bg-card border rounded-lg p-5'>
                <h4 className='font-semibold mb-3 text-sm'>Endpoint Categories</h4>
                <ul className='space-y-2'>
                  {ENDPOINT_GROUPS.map((g) => (
                    <li key={g.id}>
                      <button
                        onClick={() => { setTab('endpoints'); setActiveGroup(g.id); }}
                        className='flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors'
                      >
                        <span className='flex items-center gap-2'>
                          {g.icon}
                          {g.label}
                        </span>
                        <span className='text-xs bg-muted px-1.5 py-0.5 rounded'>{g.endpoints.length}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Endpoints Tab */}
        {tab === 'endpoints' && (
          <div className='space-y-4'>
            {/* Search + filter bar */}
            <div className='flex flex-col sm:flex-row gap-3'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-2.5 w-4 h-4 text-muted-foreground' />
                <input
                  type='text'
                  placeholder='Search endpoints, paths, descriptions…'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className='w-full pl-9 pr-3 py-2 border border-border rounded-md bg-input text-foreground text-sm focus:ring-2 focus:ring-primary focus:outline-none'
                />
              </div>
              <div className='flex gap-1 flex-wrap'>
                <button
                  onClick={() => setActiveGroup(null)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                    activeGroup === null
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
                {ENDPOINT_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                      activeGroup === g.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Method legend */}
            <div className='flex items-center gap-3 flex-wrap text-xs text-muted-foreground'>
              <span>Method:</span>
              {(Object.keys(METHOD_STYLES) as HttpMethod[]).map((m) => (
                <span key={m} className={`px-1.5 py-0.5 rounded font-mono font-bold ${METHOD_STYLES[m]}`}>{m}</span>
              ))}
              <span className='ml-2 text-xs px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30'>Admin</span>
              <span>= Admin / admin-scoped session required</span>
            </div>

            {filtered.length === 0 ? (
              <div className='text-center py-12 text-muted-foreground'>No endpoints match your search.</div>
            ) : (
              <div className='space-y-3'>
                {filtered.map((group) => (
                  <GroupSection key={group.id} group={group} />
                ))}
              </div>
            )}

            <p className='text-xs text-muted-foreground text-right pt-2'>
              Showing {filtered.reduce((s, g) => s + g.endpoints.length, 0)} of {totalEndpoints} endpoints
            </p>
          </div>
        )}

        {/* Examples Tab */}
        {tab === 'examples' && (
          <div className='max-w-3xl space-y-6'>
            <section className='bg-card border rounded-lg p-6'>
              <h3 className='text-lg font-bold mb-4 flex items-center gap-2'>
                <Terminal className='w-5 h-5 text-primary' />
                cURL / Shell
              </h3>
              <pre className='bg-muted p-4 rounded-md overflow-x-auto border border-border'>
                <code className='text-sm font-mono text-foreground'>{curlExample}</code>
              </pre>
            </section>

            <section className='bg-card border rounded-lg p-6'>
              <h3 className='text-lg font-bold mb-4 flex items-center gap-2'>
                <Code className='w-5 h-5 text-primary' />
                Node.js / TypeScript
              </h3>
              <pre className='bg-muted p-4 rounded-md overflow-x-auto border border-border'>
                <code className='text-sm font-mono text-foreground'>{nodeExample}</code>
              </pre>
            </section>

            <section className='bg-card border rounded-lg p-6'>
              <h3 className='text-lg font-bold mb-4 flex items-center gap-2'>
                <Code className='w-5 h-5 text-primary' />
                Python
              </h3>
              <pre className='bg-muted p-4 rounded-md overflow-x-auto border border-border'>
                <code className='text-sm font-mono text-foreground'>{pythonExample}</code>
              </pre>
            </section>

            <section className='bg-card border rounded-lg p-6'>
              <h3 className='text-lg font-bold mb-4 flex items-center gap-2'>
                <Clock className='w-5 h-5 text-primary' />
                Polling for async operations
              </h3>
              <p className='text-sm text-muted-foreground mb-4'>
                Some operations (instance start, backup restore) are asynchronous. Poll the status endpoint until completion:
              </p>
              <pre className='bg-muted p-4 rounded-md overflow-x-auto border border-border'>
                <code className='text-sm font-mono text-foreground'>{`async function waitForRunning(name, maxWait = 60_000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const { data } = await client.get(\`/instances/\${name}/status\`);
    if (data.status === 'running') return data;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Timed out waiting for instance');
}

await client.post('/instances/my-project/start');
await waitForRunning('my-project');`}</code>
              </pre>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
