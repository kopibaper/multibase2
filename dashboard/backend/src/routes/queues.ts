import { Router } from 'express';
import { QueueService } from '../services/QueueService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';

export function createQueueRoutes(queueService: QueueService) {
  const router = Router({ mergeParams: true });

  // Extension status
  router.get('/status', requireAuth, requireScope(SCOPES.QUEUES.READ), async (req, res) => {
    try {
      const status = await queueService.getStatus(req.params.name);
      return res.json(status);
    } catch (error: any) {
      logger.error(`Error getting queue status for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Enable pgmq
  router.post('/enable', requireAuth, requireScope(SCOPES.QUEUES.WRITE), async (req, res) => {
    try {
      const result = await queueService.enableExtension(req.params.name);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error enabling pgmq for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // List queues
  router.get('/', requireAuth, requireScope(SCOPES.QUEUES.READ), async (req, res) => {
    try {
      const result = await queueService.listQueues(req.params.name);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error listing queues for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Create a queue
  router.post('/', requireAuth, requireScope(SCOPES.QUEUES.WRITE), async (req, res) => {
    try {
      const { queueName } = req.body;
      if (!queueName) return res.status(400).json({ error: 'queueName is required' });

      const result = await queueService.createQueue(req.params.name, queueName);
      return res.status(201).json(result);
    } catch (error: any) {
      logger.error(`Error creating queue for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Drop a queue
  router.delete('/:queueName', requireAuth, requireScope(SCOPES.QUEUES.WRITE), async (req, res) => {
    try {
      const result = await queueService.dropQueue(req.params.name, req.params.queueName);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error dropping queue ${req.params.queueName}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Read messages from a queue
  router.get('/:queueName/messages', requireAuth, requireScope(SCOPES.QUEUES.READ), async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const vt = req.query.vt ? parseInt(req.query.vt as string, 10) : 30;
      const messages = await queueService.readMessages(req.params.name, req.params.queueName, limit, vt);
      return res.json({ messages });
    } catch (error: any) {
      logger.error(`Error reading messages from ${req.params.queueName}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Send a message
  router.post('/:queueName/send', requireAuth, requireScope(SCOPES.QUEUES.WRITE), async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: 'message is required' });

      const result = await queueService.sendMessage(req.params.name, req.params.queueName, message);
      return res.status(201).json(result);
    } catch (error: any) {
      logger.error(`Error sending message to ${req.params.queueName}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Purge a queue
  router.post('/:queueName/purge', requireAuth, requireScope(SCOPES.QUEUES.WRITE), async (req, res) => {
    try {
      const result = await queueService.purgeQueue(req.params.name, req.params.queueName);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error purging queue ${req.params.queueName}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Queue metrics
  router.get('/:queueName/metrics', requireAuth, requireScope(SCOPES.QUEUES.READ), async (req, res) => {
    try {
      const metrics = await queueService.getQueueMetrics(req.params.name, req.params.queueName);
      return res.json({ metrics });
    } catch (error: any) {
      logger.error(`Error getting metrics for queue ${req.params.queueName}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
