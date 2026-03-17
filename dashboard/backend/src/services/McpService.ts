import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import InstanceManager from './InstanceManager';
import DockerManager from './DockerManager';
import MetricsCollector from './MetricsCollector';

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
];

const SENSITIVE_KEYS = /secret|password|key|token|jwt|pass/i;

export class McpService {
  constructor(
    private readonly instanceManager: InstanceManager,
    private readonly dockerManager: DockerManager,
    private readonly metricsCollector: MetricsCollector,
    private readonly prisma: PrismaClient
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
}

export default McpService;
