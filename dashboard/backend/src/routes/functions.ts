import { Router } from 'express';
import { FunctionService } from '../services/FunctionService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

export function createFunctionRoutes(functionService: FunctionService) {
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

  return router;
}
