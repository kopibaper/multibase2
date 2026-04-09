import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import McpService from '../services/McpService';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';

export function createMcpRoutes(mcpService: McpService) {
  const router = Router();

  // GET /api/mcp/info — server info + tool listing (used by settings page and MCP clients)
  router.get('/info', requireAuth, requireScope(SCOPES.MCP.READ), (_req, res) => {
    return res.json({
      server: mcpService.getServerInfo(),
      tools: mcpService.getTools(),
      protocol: 'mcp/1.0',
    });
  });

  // POST /api/mcp — JSON-RPC 2.0 endpoint for MCP clients
  router.post('/', requireAuth, requireScope(SCOPES.MCP.WRITE), async (req, res) => {
    const { jsonrpc, method, params, id } = req.body;

    if (jsonrpc !== '2.0') {
      return res.status(400).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request' } });
    }

    try {
      switch (method) {
        case 'initialize': {
          return res.json({
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: mcpService.getServerInfo(),
            },
          });
        }

        case 'tools/list': {
          return res.json({
            jsonrpc: '2.0',
            id,
            result: { tools: mcpService.getTools() },
          });
        }

        case 'tools/call': {
          const { name, arguments: args = {} } = params ?? {};
          if (!name) {
            return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'tool name required' } });
          }
          const result = await mcpService.callTool(name, args);
          return res.json({ jsonrpc: '2.0', id, result });
        }

        case 'ping': {
          return res.json({ jsonrpc: '2.0', id, result: {} });
        }

        default: {
          return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
        }
      }
    } catch (err: any) {
      return res.status(500).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32603, message: err.message } });
    }
  });

  return router;
}
