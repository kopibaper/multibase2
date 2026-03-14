import { Router } from 'express';
import { FunctionService } from '../services/FunctionService';
import { InstanceManager } from '../services/InstanceManager';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import axios from 'axios';

export function createFunctionRoutes(functionService: FunctionService, instanceManager?: InstanceManager) {
  const router = Router({ mergeParams: true });

  // List functions
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      const functions = await functionService.listFunctions(name);
      res.json({ functions });
    } catch (error: any) {
      logger.error(`Error listing functions for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get function code
  router.get('/:functionName', requireAuth, async (req, res) => {
    try {
      const { name, functionName } = req.params;
      const code = await functionService.getFunction(name, functionName);
      res.json({ code });
    } catch (error: any) {
      logger.error(`Error getting function ${req.params.functionName}:`, error);
      res.status(404).json({ error: error.message });
    }
  });

  // Save function
  router.put('/:functionName', requireAuth, async (req, res) => {
    try {
      const { name, functionName } = req.params;
      const { code } = req.body;
      await functionService.saveFunction(name, functionName, code);
      res.json({ message: 'Function saved' });
    } catch (error: any) {
      logger.error(`Error saving function ${req.params.functionName}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete function
  router.delete('/:functionName', requireAuth, async (req, res) => {
    try {
      const { name, functionName } = req.params;
      await functionService.deleteFunction(name, functionName);
      res.json({ message: 'Function deleted' });
    } catch (error: any) {
      logger.error(`Error deleting function ${req.params.functionName}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Deploy function (simulated)
  router.post('/:functionName/deploy', requireAuth, async (req, res) => {
    try {
      const { name, functionName } = req.params;
      await functionService.deployFunction(name, functionName);
      res.json({ message: 'Function deployed (simulated)' });
    } catch (error: any) {
      logger.error(`Error deploying function ${req.params.functionName}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get function logs
  router.get('/:functionName/logs', requireAuth, async (req, res) => {
    try {
      const { name, functionName } = req.params;
      const logs = await functionService.getFunctionLogs(name, functionName);
      res.json({ logs });
    } catch (error: any) {
      logger.error(`Error getting logs for function ${req.params.functionName}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get function env vars
  router.get('/:functionName/env', requireAuth, async (req, res) => {
    try {
      const { name, functionName } = req.params;
      const envVars = await functionService.getFunctionEnv(name, functionName);
      res.json({ envVars });
    } catch (error: any) {
      logger.error(`Error getting env for function ${req.params.functionName}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save function env vars
  router.put('/:functionName/env', requireAuth, async (req, res) => {
    try {
      const { name, functionName } = req.params;
      const { envVars } = req.body;
      if (!envVars || typeof envVars !== 'object') {
        return res.status(400).json({ error: 'envVars must be an object' });
      }
      await functionService.saveFunctionEnv(name, functionName, envVars);
      return res.json({ message: 'Function env saved' });
    } catch (error: any) {
      logger.error(`Error saving env for function ${req.params.functionName}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Invoke function (test-runner)
  router.post('/:functionName/invoke', requireAuth, async (req, res) => {
    try {
      const { name, functionName } = req.params;
      const { method = 'POST', headers: extraHeaders = {}, body: reqBody } = req.body;

      if (!instanceManager) {
        return res.status(501).json({ error: 'instanceManager not available' });
      }

      const env = await instanceManager.getInstanceEnv(name);
      const kongPort = parseInt(env['KONG_HTTP_PORT'] || env['API_PORT'] || '8000', 10);
      const functionUrl = `http://localhost:${kongPort}/functions/v1/${functionName}`;

      const response = await axios({
        method: (method as string).toLowerCase() as any,
        url: functionUrl,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env['ANON_KEY'] || ''}`,
          ...extraHeaders,
        },
        data: reqBody,
        timeout: 15000,
        validateStatus: () => true,
      });

      return res.json({
        status: response.status,
        headers: response.headers,
        body: response.data,
      });
    } catch (error: any) {
      logger.error(`Error invoking function ${req.params.functionName}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
