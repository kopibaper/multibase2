import { Router } from 'express';
import { WebhookService } from '../services/WebhookService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';
import { auditLog } from '../middleware/auditLog';

export function createWebhookRoutes(webhookService: WebhookService) {
  const router = Router({ mergeParams: true });

  // List all webhooks for an instance
  router.get('/', requireAuth, requireScope(SCOPES.WEBHOOKS.READ), async (req, res) => {
    try {
      const { name } = req.params;
      const webhooks = await webhookService.listWebhooks(name);
      return res.json({ webhooks });
    } catch (error: any) {
      logger.error(`Error listing webhooks for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Create a new webhook
  router.post('/', requireAuth, requireScope(SCOPES.WEBHOOKS.CREATE), auditLog('WEBHOOK_CREATE', { includeBody: true, getResource: (req) => `${req.params.name}/${req.body?.name || 'unknown'}` }), async (req, res) => {
    try {
      const { name } = req.params;
      const { name: whName, tableSchema, tableName, events, url, method, headers, timeoutMs } = req.body;

      if (!whName || !tableName || !url || !events?.length) {
        return res.status(400).json({ error: 'name, tableName, url, and events are required' });
      }

      const result = await webhookService.createWebhook(name, {
        name: whName,
        tableSchema: tableSchema || 'public',
        tableName,
        events,
        url,
        method,
        headers,
        timeoutMs,
      });
      return res.status(201).json(result);
    } catch (error: any) {
      logger.error(`Error creating webhook for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Delete a webhook
  router.delete('/:webhookId', requireAuth, requireScope(SCOPES.WEBHOOKS.DELETE), auditLog('WEBHOOK_DELETE', { getResource: (req) => `${req.params.name}/${req.params.webhookId}` }), async (req, res) => {
    try {
      const { name, webhookId } = req.params;
      const id = parseInt(webhookId, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid webhook ID' });

      const result = await webhookService.deleteWebhook(name, id);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error deleting webhook ${req.params.webhookId}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Toggle enabled / disabled
  router.patch('/:webhookId', requireAuth, requireScope(SCOPES.WEBHOOKS.UPDATE), auditLog('WEBHOOK_UPDATE', { includeBody: true, getResource: (req) => `${req.params.name}/${req.params.webhookId}` }), async (req, res) => {
    try {
      const { name, webhookId } = req.params;
      const { enabled } = req.body;
      const id = parseInt(webhookId, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid webhook ID' });
      if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) is required' });

      const result = await webhookService.toggleWebhook(name, id, enabled);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error toggling webhook ${req.params.webhookId}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
