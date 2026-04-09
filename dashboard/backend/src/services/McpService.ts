import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import InstanceManager from './InstanceManager';
import DockerManager from './DockerManager';
import MetricsCollector from './MetricsCollector';
import { FunctionService } from './FunctionService';
import { StorageService } from './StorageService';
import { MigrationService } from './MigrationService';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

const TOOLS: McpTool[] = [
  {
    name: 'list_instances',
    description: 'List all Supabase instances managed by this Multibase server',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_instance',
    description: 'Get detailed information about a specific instance',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Instance name' } }, required: ['name'] },
  },
  {
    name: 'start_instance',
    description: 'Start a stopped Supabase instance',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Instance name' } }, required: ['name'] },
  },
  {
    name: 'stop_instance',
    description: 'Stop a running Supabase instance',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Instance name' } }, required: ['name'] },
  },
  {
    name: 'get_instance_logs',
    description: 'Get recent logs for an instance service',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        service: { type: 'string', description: 'Service name (db, auth, storage, realtime, kong)', enum: ['db', 'auth', 'storage', 'realtime', 'kong', 'studio'] },
        lines: { type: 'string', description: 'Number of log lines (default: 50)' },
      },
      required: ['name', 'service'],
    },
  },
  {
    name: 'get_instance_metrics',
    description: 'Get current resource metrics for an instance',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Instance name' } }, required: ['name'] },
  },
  {
    name: 'list_functions',
    description: 'List edge functions for an instance',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Instance name' } }, required: ['name'] },
  },
  {
    name: 'get_function_code',
    description: 'Get the source code of an edge function',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        function_name: { type: 'string', description: 'Function name' },
      },
      required: ['name', 'function_name'],
    },
  },
  {
    name: 'list_instances_by_status',
    description: 'List instances filtered by status',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string', description: 'Status filter', enum: ['running', 'stopped', 'degraded', 'healthy'] } },
      required: ['status'],
    },
  },
  {
    name: 'get_system_overview',
    description: 'Get a high-level overview of all instances and system health',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_instance_env',
    description: 'Get non-sensitive environment variables for an instance (secrets redacted)',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Instance name' } }, required: ['name'] },
  },
  {
    name: 'list_storage_buckets',
    description: 'List storage buckets for an instance',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Instance name' } }, required: ['name'] },
  },
  // ===== STORAGE CRUD =====
  {
    name: 'create_bucket',
    description: 'Create a new storage bucket in an instance',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        bucketName: { type: 'string', description: 'Name of the bucket to create' },
        isPublic: { type: 'string', description: 'Whether the bucket is public (true/false)' },
      },
      required: ['name', 'bucketName'],
    },
  },
  {
    name: 'delete_bucket',
    description: 'Delete a storage bucket from an instance',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        bucketId: { type: 'string', description: 'Bucket ID to delete' },
      },
      required: ['name', 'bucketId'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a storage bucket',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        bucketId: { type: 'string', description: 'Bucket ID' },
        path: { type: 'string', description: 'Path prefix to filter files (optional)' },
      },
      required: ['name', 'bucketId'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from a storage bucket',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        bucketId: { type: 'string', description: 'Bucket ID' },
        filePath: { type: 'string', description: 'File path within the bucket' },
      },
      required: ['name', 'bucketId', 'filePath'],
    },
  },
  {
    name: 'get_file_url',
    description: 'Get the public or signed URL for a file in a bucket',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        bucketId: { type: 'string', description: 'Bucket ID' },
        filePath: { type: 'string', description: 'File path within the bucket' },
        signed: { type: 'string', description: 'Whether to generate a signed URL (true/false)' },
        expiresIn: { type: 'string', description: 'Signed URL expiry in seconds (default: 3600)' },
      },
      required: ['name', 'bucketId', 'filePath'],
    },
  },
  // ===== EDGE FUNCTIONS CRUD =====
  {
    name: 'get_function',
    description: 'Get the source code of an edge function',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        functionName: { type: 'string', description: 'Edge function name' },
      },
      required: ['name', 'functionName'],
    },
  },
  {
    name: 'create_function',
    description: 'Create a new edge function',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        functionName: { type: 'string', description: 'Name for the new edge function' },
        code: { type: 'string', description: 'TypeScript source code (optional, uses starter template if omitted)' },
      },
      required: ['name', 'functionName'],
    },
  },
  {
    name: 'update_function',
    description: 'Update the source code of an existing edge function',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        functionName: { type: 'string', description: 'Edge function name' },
        code: { type: 'string', description: 'New TypeScript source code' },
      },
      required: ['name', 'functionName', 'code'],
    },
  },
  {
    name: 'delete_function',
    description: 'Delete an edge function',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        functionName: { type: 'string', description: 'Edge function name to delete' },
      },
      required: ['name', 'functionName'],
    },
  },
  {
    name: 'deploy_function',
    description: 'Deploy an edge function to the running instance',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        functionName: { type: 'string', description: 'Edge function name to deploy' },
      },
      required: ['name', 'functionName'],
    },
  },
  {
    name: 'invoke_function',
    description: 'Invoke (call) an edge function via HTTP',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        functionName: { type: 'string', description: 'Edge function name to invoke' },
        method: { type: 'string', description: 'HTTP method (default: POST)', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        payload: { type: 'string', description: 'JSON payload to send (optional)' },
      },
      required: ['name', 'functionName'],
    },
  },
  {
    name: 'get_function_logs',
    description: 'Get recent logs for an edge function',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        functionName: { type: 'string', description: 'Edge function name' },
      },
      required: ['name', 'functionName'],
    },
  },
  // ===== DATABASE =====
  {
    name: 'execute_sql',
    description: 'Execute a SQL query against an instance database',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        sql: { type: 'string', description: 'SQL statement to execute' },
      },
      required: ['name', 'sql'],
    },
  },
  {
    name: 'list_tables',
    description: 'List all tables in an instance database schema',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        schema: { type: 'string', description: 'Schema name (default: public)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'describe_table',
    description: 'Get column definitions for a specific table',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: 'Schema name (default: public)' },
      },
      required: ['name', 'table'],
    },
  },
  // ===== ROW LEVEL SECURITY =====
  {
    name: 'list_rls_policies',
    description: 'List Row Level Security policies for an instance',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        table: { type: 'string', description: 'Filter by table name (optional)' },
        schema: { type: 'string', description: 'Schema name (default: public)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_rls_policy',
    description: 'Create a new Row Level Security policy on a table',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        table: { type: 'string', description: 'Table name' },
        policyName: { type: 'string', description: 'Policy name' },
        command: { type: 'string', description: 'SQL command the policy applies to', enum: ['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
        schema: { type: 'string', description: 'Schema name (default: public)' },
        roles: { type: 'string', description: 'Roles to apply policy to (e.g. authenticated)' },
        usingExpression: { type: 'string', description: 'USING expression (for SELECT/UPDATE/DELETE)' },
        withCheckExpression: { type: 'string', description: 'WITH CHECK expression (for INSERT/UPDATE)' },
      },
      required: ['name', 'table', 'policyName', 'command'],
    },
  },
  {
    name: 'drop_rls_policy',
    description: 'Drop a Row Level Security policy from a table',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        table: { type: 'string', description: 'Table name' },
        policyName: { type: 'string', description: 'Policy name to drop' },
        schema: { type: 'string', description: 'Schema name (default: public)' },
      },
      required: ['name', 'table', 'policyName'],
    },
  },
  {
    name: 'enable_rls',
    description: 'Enable Row Level Security on a table',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: 'Schema name (default: public)' },
      },
      required: ['name', 'table'],
    },
  },
  {
    name: 'disable_rls',
    description: 'Disable Row Level Security on a table',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        table: { type: 'string', description: 'Table name' },
        schema: { type: 'string', description: 'Schema name (default: public)' },
      },
      required: ['name', 'table'],
    },
  },
  // ===== AUTH USERS =====
  {
    name: 'list_auth_users',
    description: 'List authenticated users in an instance',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Instance name' },
        page: { type: 'string', description: 'Page number (default: 1)' },
        perPage: { type: 'string', description: 'Results per page (default: 50, max: 200)' },
      },
      required: ['name'],
    },
  },
];

const SENSITIVE_KEYS = /secret|password|key|token|jwt|pass/i;

export class McpService {
  constructor(
    private readonly instanceManager: InstanceManager,
    private readonly dockerManager: DockerManager,
    private readonly metricsCollector: MetricsCollector,
    private readonly prisma: PrismaClient,
    private readonly functionService?: FunctionService,
    private readonly storageService?: StorageService
  ) {}

  getTools(): McpTool[] {
    return TOOLS;
  }

  getServerInfo() {
    return {
      name: 'multibase-mcp',
      version: '3.0.0',
      description: 'Multibase MCP Server — manage Supabase instances via Claude, Cursor, or any MCP client',
    };
  }

  async callTool(toolName: string, args: Record<string, any>): Promise<McpToolResult> {
    try {
      switch (toolName) {
        case 'list_instances':       return this.listInstances();
        case 'get_instance':         return this.getInstance(args.name);
        case 'start_instance':       return this.startInstance(args.name);
        case 'stop_instance':        return this.stopInstance(args.name);
        case 'get_instance_logs':    return this.getInstanceLogs(args.name, args.service, parseInt(args.lines ?? '50', 10));
        case 'get_instance_metrics': return this.getInstanceMetrics(args.name);
        case 'list_functions':       return this.listFunctions(args.name);
        case 'get_function_code':    return this.getFunctionCode(args.name, args.function_name);
        case 'list_instances_by_status': return this.listInstancesByStatus(args.status);
        case 'get_system_overview':  return this.getSystemOverview();
        case 'get_instance_env':     return this.getInstanceEnv(args.name);
        case 'list_storage_buckets': return this.listStorageBuckets(args.name);
        // storage crud
        case 'create_bucket':   return this.createBucket(args.name, args.bucketName, args.isPublic === 'true');
        case 'delete_bucket':   return this.deleteBucket(args.name, args.bucketId);
        case 'list_files':      return this.listFiles(args.name, args.bucketId, args.path ?? '');
        case 'delete_file':     return this.deleteFile(args.name, args.bucketId, args.filePath);
        case 'get_file_url':    return this.getFileUrl(args.name, args.bucketId, args.filePath, args.signed === 'true', parseInt(args.expiresIn ?? '3600', 10));
        // edge functions crud
        case 'get_function':    return this.getFunction(args.name, args.functionName);
        case 'create_function': return this.createFunction(args.name, args.functionName, args.code);
        case 'update_function': return this.updateFunction(args.name, args.functionName, args.code);
        case 'delete_function': return this.deleteFunction(args.name, args.functionName);
        case 'deploy_function': return this.deployFunction(args.name, args.functionName);
        case 'invoke_function': return this.invokeFunction(args.name, args.functionName, args.method ?? 'POST', args.payload);
        case 'get_function_logs': return this.getFunctionLogs(args.name, args.functionName);
        // database
        case 'execute_sql':       return this.executeSql(args.name, args.sql);
        case 'list_tables':       return this.listTables(args.name, args.schema ?? 'public');
        case 'describe_table':    return this.describeTable(args.name, args.table, args.schema ?? 'public');
        // rls
        case 'list_rls_policies': return this.listRlsPolicies(args.name, args.table, args.schema ?? 'public');
        case 'create_rls_policy': return this.createRlsPolicy(args.name, args.table, args.policyName, args.command, args.schema ?? 'public', args.roles, args.usingExpression, args.withCheckExpression);
        case 'drop_rls_policy':   return this.dropRlsPolicy(args.name, args.table, args.policyName, args.schema ?? 'public');
        case 'enable_rls':        return this.setRls(args.name, args.table, args.schema ?? 'public', true);
        case 'disable_rls':       return this.setRls(args.name, args.table, args.schema ?? 'public', false);
        // auth users
        case 'list_auth_users':   return this.listAuthUsers(args.name, parseInt(args.page ?? '1', 10), parseInt(args.perPage ?? '50', 10));
        default: return this.error(`Unknown tool: ${toolName}`);
      }
    } catch (err: any) {
      logger.error(`MCP tool ${toolName} error:`, err);
      return this.error(err.message ?? String(err));
    }
  }

  private text(content: string): McpToolResult {
    return { content: [{ type: 'text', text: content }] };
  }

  private json(obj: any): McpToolResult {
    return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
  }

  private error(msg: string): McpToolResult {
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }

  private async listInstances(): Promise<McpToolResult> {
    const instances = await this.instanceManager.listInstances();
    return this.json(instances.map((i) => ({ name: i.name, status: i.status, basePort: i.basePort })));
  }

  private async getInstance(name: string): Promise<McpToolResult> {
    const instance = await this.instanceManager.getInstance(name);
    if (!instance) return this.error(`Instance '${name}' not found`);
    return this.json({ name: instance.name, status: instance.status, basePort: instance.basePort });
  }

  private async startInstance(name: string): Promise<McpToolResult> {
    const instance = await this.instanceManager.getInstance(name);
    if (!instance) return this.error(`Instance '${name}' not found`);
    await this.instanceManager.startInstance(name);
    return this.text(`Instance '${name}' start command issued`);
  }

  private async stopInstance(name: string): Promise<McpToolResult> {
    const instance = await this.instanceManager.getInstance(name);
    if (!instance) return this.error(`Instance '${name}' not found`);
    await this.instanceManager.stopInstance(name);
    return this.text(`Instance '${name}' stop command issued`);
  }

  private async getInstanceLogs(name: string, service: string, lines: number): Promise<McpToolResult> {
    try {
      const containers = await this.dockerManager.listProjectContainers(name);
      const target = containers.find((c: any) => {
        const cname = (c.Names?.[0] ?? c.name ?? '').toLowerCase();
        return cname.includes(service.toLowerCase());
      });
      if (!target) return this.error(`No container found for service '${service}' in instance '${name}'`);

      const docker = (this.dockerManager as any).docker;
      const container = docker.getContainer(target.Id);
      const logBuf = await container.logs({ stdout: true, stderr: true, tail: lines, timestamps: true });
      return this.text(logBuf.toString('utf8'));
    } catch (err: any) {
      return this.error(err.message);
    }
  }

  private async getInstanceMetrics(name: string): Promise<McpToolResult> {
    try {
      const containers = await this.dockerManager.listProjectContainers(name);
      const stats = await Promise.all(
        containers.slice(0, 6).map(async (c: any) => {
          try {
            const s = await this.dockerManager.getContainerStats(c.Id);
            return { container: c.Names?.[0] ?? c.Id, cpu: s?.cpu, memory: s?.memory };
          } catch {
            return { container: c.Names?.[0] ?? c.Id, cpu: null, memory: null };
          }
        })
      );
      return this.json(stats);
    } catch (err: any) {
      return this.error(err.message);
    }
  }

  private async listFunctions(name: string): Promise<McpToolResult> {
    try {
      const functionsPath = (this.instanceManager as any).getFunctionsPath?.(name);
      if (!functionsPath) return this.text('Functions directory not available');
      const fs = await import('fs');
      const entries = fs.readdirSync(functionsPath, { withFileTypes: true });
      const funcs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
      return this.json({ functions: funcs });
    } catch (err: any) {
      return this.error(err.message);
    }
  }

  private async getFunctionCode(name: string, functionName: string): Promise<McpToolResult> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const projectsPath = (this.instanceManager as any).projectsPath ?? '/projects';
      const indexPath = path.join(projectsPath, name, 'volumes', 'functions', functionName, 'index.ts');
      if (!fs.existsSync(indexPath)) return this.error(`Function '${functionName}' not found`);
      const code = fs.readFileSync(indexPath, 'utf8');
      return this.text(code);
    } catch (err: any) {
      return this.error(err.message);
    }
  }

  private async listInstancesByStatus(status: string): Promise<McpToolResult> {
    const instances = await this.instanceManager.listInstances();
    const filtered = instances.filter((i) => i.status === status);
    return this.json(filtered.map((i) => ({ name: i.name, status: i.status, basePort: i.basePort })));
  }

  private async getSystemOverview(): Promise<McpToolResult> {
    const instances = await this.instanceManager.listInstances();
    const total = instances.length;
    const running = instances.filter((i) => ['running', 'healthy'].includes(i.status)).length;
    const stopped = instances.filter((i) => i.status === 'stopped').length;
    const degraded = instances.filter((i) => i.status === 'degraded').length;
    return this.json({ total, running, stopped, degraded, summary: `${running}/${total} instances healthy` });
  }

  private async getInstanceEnv(name: string): Promise<McpToolResult> {
    const env = await this.instanceManager.getInstanceEnv(name);
    const safe: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      safe[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : String(v);
    }
    return this.json(safe);
  }

  private async listStorageBuckets(name: string): Promise<McpToolResult> {
    try {
      const env = await this.instanceManager.getInstanceEnv(name);
      const apiUrl = env.API_URL || `http://localhost:${env.KONG_HTTP_PORT || 8000}`;
      const anonKey = env.ANON_KEY || '';
      const axios = (await import('axios')).default;
      const resp = await axios.get(`${apiUrl}/storage/v1/bucket`, {
        headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
        timeout: 5000,
      });
      return this.json(resp.data);
    } catch (err: any) {
      return this.error(err.message);
    }
  }

  // ===== STORAGE CRUD =====

  private async createBucket(name: string, bucketName: string, isPublic: boolean): Promise<McpToolResult> {
    if (!this.storageService) return this.error('Storage service not available');
    const bucket = await this.storageService.createBucket(name, bucketName, isPublic);
    return this.json({ message: `Bucket "${bucketName}" created.`, bucket });
  }

  private async deleteBucket(name: string, bucketId: string): Promise<McpToolResult> {
    if (!this.storageService) return this.error('Storage service not available');
    await this.storageService.deleteBucket(name, bucketId);
    return this.text(`Bucket "${bucketId}" deleted.`);
  }

  private async listFiles(name: string, bucketId: string, path: string): Promise<McpToolResult> {
    if (!this.storageService) return this.error('Storage service not available');
    const files = await this.storageService.listFiles(name, bucketId, path);
    return this.json(files);
  }

  private async deleteFile(name: string, bucketId: string, filePath: string): Promise<McpToolResult> {
    if (!this.storageService) return this.error('Storage service not available');
    await this.storageService.deleteFile(name, bucketId, filePath);
    return this.text(`File "${filePath}" deleted from bucket "${bucketId}".`);
  }

  private async getFileUrl(name: string, bucketId: string, filePath: string, signed: boolean, expiresIn: number): Promise<McpToolResult> {
    if (!this.storageService) return this.error('Storage service not available');
    if (signed) {
      const result = await this.storageService.createSignedUrl(name, bucketId, filePath, expiresIn);
      return this.json({ url: result.signedUrl, type: 'signed' });
    }
    const result = await this.storageService.getPublicUrl(name, bucketId, filePath);
    return this.json({ url: result.publicUrl, type: 'public' });
  }

  // ===== EDGE FUNCTIONS CRUD =====

  private async getFunction(name: string, functionName: string): Promise<McpToolResult> {
    if (!this.functionService) return this.error('Function service not available');
    const code = await this.functionService.getFunction(name, functionName);
    return this.json({ functionName, code });
  }

  private async createFunction(name: string, functionName: string, code?: string): Promise<McpToolResult> {
    if (!this.functionService) return this.error('Function service not available');
    const src = code ||
      `import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (_req) => {
  return new Response(JSON.stringify({ message: "Hello from ${functionName}!" }), {
    headers: { "Content-Type": "application/json" },
  });
});
`;
    await this.functionService.saveFunction(name, functionName, src);
    return this.text(`Edge function "${functionName}" created.`);
  }

  private async updateFunction(name: string, functionName: string, code: string): Promise<McpToolResult> {
    if (!this.functionService) return this.error('Function service not available');
    await this.functionService.saveFunction(name, functionName, code);
    return this.text(`Edge function "${functionName}" updated.`);
  }

  private async deleteFunction(name: string, functionName: string): Promise<McpToolResult> {
    if (!this.functionService) return this.error('Function service not available');
    await this.functionService.deleteFunction(name, functionName);
    return this.text(`Edge function "${functionName}" deleted.`);
  }

  private async deployFunction(name: string, functionName: string): Promise<McpToolResult> {
    if (!this.functionService) return this.error('Function service not available');
    await this.functionService.deployFunction(name, functionName);
    return this.text(`Edge function "${functionName}" deployed.`);
  }

  private async invokeFunction(name: string, functionName: string, method: string, payload?: string): Promise<McpToolResult> {
    const instance = await this.instanceManager.getInstance(name);
    if (!instance) return this.error(`Instance '${name}' not found`);
    const port = (instance as any).ports?.kong || (instance as any).ports?.gateway || (instance as any).basePort;
    if (!port) return this.error('Could not determine instance port');
    const url = `http://localhost:${port}/functions/v1/${functionName}`;
    const fetchOptions: RequestInit = { method };
    if (payload && method !== 'GET') {
      (fetchOptions as any).headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = payload;
    }
    const resp = await fetch(url, fetchOptions);
    const text = await resp.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch { /* keep as text */ }
    return this.json({ status: resp.status, body });
  }

  private async getFunctionLogs(name: string, functionName: string): Promise<McpToolResult> {
    if (!this.functionService) return this.error('Function service not available');
    const logs = await this.functionService.getFunctionLogs(name, functionName);
    return this.json({ functionName, logs });
  }

  // ===== DATABASE =====

  private async executeSql(name: string, sql: string): Promise<McpToolResult> {
    const migrationService = new MigrationService(this.prisma);
    const result = await migrationService.executeSql(name, sql, undefined, true);
    return this.json(result);
  }

  private async listTables(name: string, schema: string): Promise<McpToolResult> {
    const migrationService = new MigrationService(this.prisma);
    const result = await migrationService.executeSql(
      name,
      `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = '${schema}' ORDER BY table_name;`,
      undefined,
      false
    );
    return this.json({ schema, tables: result });
  }

  private async describeTable(name: string, table: string, schema: string): Promise<McpToolResult> {
    const migrationService = new MigrationService(this.prisma);
    const result = await migrationService.executeSql(
      name,
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}' ORDER BY ordinal_position;`,
      undefined,
      false
    );
    return this.json({ schema, table, columns: result });
  }

  // ===== ROW LEVEL SECURITY =====

  private async listRlsPolicies(name: string, table?: string, schema: string = 'public'): Promise<McpToolResult> {
    const migrationService = new MigrationService(this.prisma);
    const tableFilter = table ? `AND tablename = '${table}'` : '';
    const result = await migrationService.executeSql(
      name,
      `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = '${schema}' ${tableFilter} ORDER BY tablename, policyname;`,
      undefined,
      false
    );
    return this.json({ policies: result });
  }

  private async createRlsPolicy(
    name: string, table: string, policyName: string, command: string,
    schema: string, roles?: string, usingExpr?: string, withCheckExpr?: string
  ): Promise<McpToolResult> {
    const migrationService = new MigrationService(this.prisma);
    const rolesPart = roles ? `TO ${roles}` : '';
    const usingPart = usingExpr ? `USING (${usingExpr})` : '';
    const checkPart = withCheckExpr ? `WITH CHECK (${withCheckExpr})` : '';
    const sql = `CREATE POLICY "${policyName}" ON "${schema}"."${table}" AS PERMISSIVE FOR ${command} ${rolesPart} ${usingPart} ${checkPart};`;
    const result = await migrationService.executeSql(name, sql, undefined, true);
    return this.json({ message: `RLS policy "${policyName}" created on "${table}".`, result });
  }

  private async dropRlsPolicy(name: string, table: string, policyName: string, schema: string): Promise<McpToolResult> {
    const migrationService = new MigrationService(this.prisma);
    const sql = `DROP POLICY IF EXISTS "${policyName}" ON "${schema}"."${table}";`;
    const result = await migrationService.executeSql(name, sql, undefined, true);
    return this.json({ message: `RLS policy "${policyName}" dropped from "${table}".`, result });
  }

  private async setRls(name: string, table: string, schema: string, enable: boolean): Promise<McpToolResult> {
    const migrationService = new MigrationService(this.prisma);
    const action = enable ? 'ENABLE' : 'DISABLE';
    const sql = `ALTER TABLE "${schema}"."${table}" ${action} ROW LEVEL SECURITY;`;
    const result = await migrationService.executeSql(name, sql, undefined, true);
    return this.json({ message: `RLS ${enable ? 'enabled' : 'disabled'} on "${table}".`, result });
  }

  // ===== AUTH USERS =====

  private async listAuthUsers(name: string, page: number, perPage: number): Promise<McpToolResult> {
    const migrationService = new MigrationService(this.prisma);
    const safePerPage = Math.min(perPage, 200);
    const offset = (Math.max(page, 1) - 1) * safePerPage;
    const result = await migrationService.executeSql(
      name,
      `SELECT id, email, phone, email_confirmed_at, created_at, last_sign_in_at, role, banned_until FROM auth.users ORDER BY created_at DESC LIMIT ${safePerPage} OFFSET ${offset};`,
      undefined,
      false
    );
    return this.json({ page, perPage: safePerPage, users: result });
  }
}

export default McpService;
