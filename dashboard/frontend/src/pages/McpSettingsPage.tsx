import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mcpApi } from '../lib/api';
import { Server, Copy, Check, ChevronDown, ChevronRight, Loader2, Zap, Info } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MCP_ENDPOINT = `${API_BASE_URL}/api/mcp`;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className='p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors shrink-0' title='Copy'>
      {copied ? <Check className='w-4 h-4 text-green-500' /> : <Copy className='w-4 h-4' />}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className='relative rounded-md overflow-hidden'>
      <div className='absolute top-2 right-2'><CopyButton value={code} /></div>
      <pre className='bg-black text-green-400 text-xs font-mono p-4 overflow-x-auto rounded-md'><code>{code}</code></pre>
    </div>
  );
}

function ToolCard({ tool }: { tool: { name: string; description: string; inputSchema?: any } }) {
  const [expanded, setExpanded] = useState(false);
  const hasParams = tool.inputSchema && Object.keys(tool.inputSchema.properties ?? {}).length > 0;

  return (
    <div className='border border-border rounded-lg overflow-hidden'>
      <button
        onClick={() => setExpanded((v) => !v)}
        className='w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors text-left'
      >
        <div className='flex items-center gap-2'>
          <Zap className='w-4 h-4 text-primary shrink-0' />
          <span className='font-mono text-sm font-medium'>{tool.name}</span>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-xs text-muted-foreground hidden sm:block truncate max-w-xs'>{tool.description}</span>
          {expanded ? <ChevronDown className='w-4 h-4 text-muted-foreground' /> : <ChevronRight className='w-4 h-4 text-muted-foreground' />}
        </div>
      </button>
      {expanded && (
        <div className='px-4 pb-4 pt-1 border-t border-border bg-secondary/10'>
          <p className='text-sm text-muted-foreground mb-2'>{tool.description}</p>
          {hasParams && (
            <div>
              <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1'>Parameters</p>
              <div className='space-y-1'>
                {Object.entries(tool.inputSchema.properties).map(([key, schema]: [string, any]) => (
                  <div key={key} className='flex items-start gap-2 text-xs'>
                    <code className='font-mono text-primary bg-primary/10 px-1 rounded'>{key}</code>
                    <span className='text-muted-foreground'>{schema.description}</span>
                    {tool.inputSchema.required?.includes(key) && <span className='text-red-500 text-xs'>*required</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!hasParams && <p className='text-xs text-muted-foreground italic'>No parameters required</p>}
        </div>
      )}
    </div>
  );
}

export default function McpSettingsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['mcp-info'],
    queryFn: mcpApi.getInfo,
    retry: 1,
  });

  const claudeConfig = JSON.stringify({
    mcpServers: {
      multibase: {
        command: 'curl',
        args: ['-s', '-X', 'POST', `${MCP_ENDPOINT}`, '-H', 'Content-Type: application/json', '-H', 'Authorization: Bearer YOUR_API_KEY'],
      },
    },
  }, null, 2);

  const cursorConfig = JSON.stringify({
    mcp: {
      servers: {
        multibase: {
          url: MCP_ENDPOINT,
          headers: { Authorization: 'Bearer YOUR_API_KEY' },
        },
      },
    },
  }, null, 2);

  const vsCodeConfig = JSON.stringify({
    'mcp.servers': {
      multibase: {
        type: 'http',
        url: MCP_ENDPOINT,
        headers: { Authorization: 'Bearer YOUR_API_KEY' },
      },
    },
  }, null, 2);

  return (
    <div className='max-w-4xl mx-auto p-6 space-y-6'>
      <div>
        <h1 className='text-2xl font-bold flex items-center gap-3'>
          <Server className='w-6 h-6 text-primary' />
          MCP Server
        </h1>
        <p className='text-muted-foreground mt-1'>
          Model Context Protocol — connect Claude, Cursor, or any MCP client to manage your Supabase instances
        </p>
      </div>

      {/* Connection info */}
      <div className='glass-card p-5'>
        <h2 className='font-semibold mb-3 flex items-center gap-2'>
          <Info className='w-4 h-4 text-primary' />
          Server Details
        </h2>
        {isLoading ? (
          <div className='flex items-center gap-2 text-muted-foreground'><Loader2 className='w-4 h-4 animate-spin' /> Loading...</div>
        ) : error ? (
          <div className='text-sm text-destructive'>Could not load MCP server info. Ensure the backend is running.</div>
        ) : (
          <div className='space-y-3'>
            <div className='flex items-center gap-2'>
              <span className='inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-green-500/10 text-green-600 rounded-full font-medium'>
                <span className='w-1.5 h-1.5 rounded-full bg-green-500'></span>
                Online
              </span>
              <div>
                <span className='text-sm font-medium'>{data?.server.name}</span>
                <span className='text-xs text-muted-foreground ml-2'>v{data?.server.version}</span>
              </div>
            </div>
            <p className='text-sm text-muted-foreground'>{data?.server.description}</p>
            <div>
              <p className='text-xs text-muted-foreground mb-1'>JSON-RPC 2.0 Endpoint</p>
              <div className='flex items-center gap-2 bg-secondary/40 border border-border rounded-md px-3 py-2'>
                <code className='text-sm font-mono flex-1 break-all'>{MCP_ENDPOINT}</code>
                <CopyButton value={MCP_ENDPOINT} />
              </div>
            </div>
            <div>
              <p className='text-xs text-muted-foreground mb-1'>Protocol</p>
              <code className='text-xs font-mono bg-secondary px-2 py-0.5 rounded'>{data?.protocol}</code>
            </div>
          </div>
        )}
      </div>

      {/* Authentication */}
      <div className='glass-card p-5'>
        <h2 className='font-semibold mb-3'>Authentication</h2>
        <p className='text-sm text-muted-foreground mb-3'>
          The MCP endpoint uses the same authentication as the dashboard. Generate an API key in{' '}
          <a href='/api-keys' className='text-primary hover:underline'>API Keys</a> and pass it as a Bearer token.
        </p>
        <CodeBlock code='Authorization: Bearer YOUR_API_KEY' />
      </div>

      {/* Integration snippets */}
      <div className='glass-card p-5'>
        <h2 className='font-semibold mb-4'>Integration Snippets</h2>
        <div className='space-y-4'>
          <div>
            <h3 className='text-sm font-medium mb-2'>Claude Desktop (claude_desktop_config.json)</h3>
            <CodeBlock code={claudeConfig} />
          </div>
          <div>
            <h3 className='text-sm font-medium mb-2'>Cursor (.cursor/mcp.json)</h3>
            <CodeBlock code={cursorConfig} />
          </div>
          <div>
            <h3 className='text-sm font-medium mb-2'>VS Code (settings.json)</h3>
            <CodeBlock code={vsCodeConfig} />
          </div>
        </div>
      </div>

      {/* Tools list */}
      <div className='glass-card p-5'>
        <h2 className='font-semibold mb-1'>Available Tools</h2>
        <p className='text-sm text-muted-foreground mb-4'>{data?.tools?.length ?? 0} tools available to AI clients</p>
        {isLoading ? (
          <div className='flex justify-center p-4'><Loader2 className='w-5 h-5 animate-spin text-muted-foreground' /></div>
        ) : (
          <div className='space-y-2'>
            {(data?.tools ?? []).map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
