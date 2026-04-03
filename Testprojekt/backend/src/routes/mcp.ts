import { Router, Request, Response } from 'express';
import multibase, { getInstanceName } from '../lib/multibaseClient.js';

const router = Router();

// Test 1: Get MCP server info
router.get('/info', async (_req: Request, res: Response) => {
  try {
    const response = await multibase.get('/api/mcp/info');
    res.json({
      success: true,
      test: 'MCP Server Info',
      data: response.data,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'MCP Server Info',
      error: error.response?.data || error.message,
    });
  }
});

// Test 2: List available MCP tools
router.post('/list-tools', async (_req: Request, res: Response) => {
  try {
    const response = await multibase.post('/api/mcp', {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    });
    const tools = response.data?.result?.tools || [];
    res.json({
      success: true,
      test: 'MCP List Tools',
      data: {
        toolCount: tools.length,
        tools: tools.map((t: any) => t.name),
      },
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'MCP List Tools',
      error: error.response?.data || error.message,
    });
  }
});

// Test 3: Call MCP tool - list_instances
router.post('/call-tool', async (_req: Request, res: Response) => {
  try {
    const response = await multibase.post('/api/mcp', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_instances',
        arguments: {},
      },
    });
    res.json({
      success: true,
      test: 'MCP Call Tool (list_instances)',
      data: response.data?.result,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'MCP Call Tool (list_instances)',
      error: error.response?.data || error.message,
    });
  }
});

// Test 4: Get system overview via MCP
router.post('/system-overview', async (_req: Request, res: Response) => {
  try {
    const response = await multibase.post('/api/mcp', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_system_overview',
        arguments: {},
      },
    });
    res.json({
      success: true,
      test: 'MCP System Overview',
      data: response.data?.result,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'MCP System Overview',
      error: error.response?.data || error.message,
    });
  }
});

// Test 5: Get instance details via MCP
router.post('/get-instance', async (_req: Request, res: Response) => {
  try {
    const instanceName = getInstanceName();
    const response = await multibase.post('/api/mcp', {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_instance',
        arguments: { name: instanceName },
      },
    });
    res.json({
      success: true,
      test: `MCP Get Instance (${instanceName})`,
      data: response.data?.result,
    });
  } catch (error: any) {
    res.json({
      success: false,
      test: 'MCP Get Instance',
      error: error.response?.data || error.message,
    });
  }
});

export default router;
