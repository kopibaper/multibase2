import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';
import InstanceManager from '../services/InstanceManager';
import LogDrainService from '../services/LogDrainService';
import { auditLog } from '../middleware/auditLog';

export function createLogDrainRoutes(
  prisma: PrismaClient,
  instanceManager: InstanceManager,
  logDrainService: LogDrainService
) {
  const router = Router({ mergeParams: true });

  // GET /api/instances/:name/log-drains
  router.get('/', requireAuth, requireScope(SCOPES.LOG_DRAINS.READ), async (req, res) => {
    try {
      const { name } = req.params as { name: string };
      const instance = await instanceManager.getInstance(name);
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      const drains = await prisma.logDrain.findMany({ where: { instanceId: instance.id }, orderBy: { createdAt: 'desc' } });
      return res.json({ drains: drains.map((d) => ({ ...d, services: JSON.parse(d.services) })) });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/instances/:name/log-drains
  router.post('/', requireAuth, requireScope(SCOPES.LOG_DRAINS.CREATE), auditLog('LOG_DRAIN_CREATE', { includeBody: true, getResource: (req) => `${req.params.name}/${req.body?.name || 'unknown'}` }), async (req, res) => {
    try {
      const { name } = req.params as { name: string };
      const { name: drainName, url, services = [], format = 'json', enabled = true } = req.body;

      if (!drainName || typeof drainName !== 'string') return res.status(400).json({ error: 'name is required' });
      if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });
      if (!['json', 'ndjson', 'logfmt'].includes(format)) return res.status(400).json({ error: 'Invalid format' });

      const instance = await instanceManager.getInstance(name);
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      const drain = await prisma.logDrain.create({
        data: {
          instanceId: instance.id,
          name: drainName,
          url,
          services: JSON.stringify(Array.isArray(services) ? services : []),
          format,
          enabled: Boolean(enabled),
        },
      });

      return res.json({ drain: { ...drain, services: JSON.parse(drain.services) } });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/instances/:name/log-drains/:id
  router.patch('/:id', requireAuth, requireScope(SCOPES.LOG_DRAINS.UPDATE), auditLog('LOG_DRAIN_UPDATE', { includeBody: true, getResource: (req) => `${req.params.name}/${req.params.id}` }), async (req, res) => {
    try {
      const { name, id } = req.params as { name: string; id: string };
      const { name: drainName, url, services, format, enabled } = req.body;

      const instance = await instanceManager.getInstance(name);
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      const existing = await prisma.logDrain.findFirst({ where: { id, instanceId: instance.id } });
      if (!existing) return res.status(404).json({ error: 'Drain not found' });

      const updated: any = {};
      if (drainName !== undefined) updated.name = drainName;
      if (url !== undefined) updated.url = url;
      if (services !== undefined) updated.services = JSON.stringify(Array.isArray(services) ? services : []);
      if (format !== undefined) {
        if (!['json', 'ndjson', 'logfmt'].includes(format)) return res.status(400).json({ error: 'Invalid format' });
        updated.format = format;
      }
      if (enabled !== undefined) updated.enabled = Boolean(enabled);

      const drain = await prisma.logDrain.update({ where: { id }, data: updated });
      return res.json({ drain: { ...drain, services: JSON.parse(drain.services) } });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /api/instances/:name/log-drains/:id/test
  router.post('/:id/test', requireAuth, requireScope(SCOPES.LOG_DRAINS.READ), async (req, res) => {
    try {
      const { name, id } = req.params as { name: string; id: string };
      const instance = await instanceManager.getInstance(name);
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      const drain = await prisma.logDrain.findFirst({ where: { id, instanceId: instance.id } });
      if (!drain) return res.status(404).json({ error: 'Drain not found' });

      const result = await logDrainService.testDeliver(id);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/instances/:name/log-drains/:id
  router.delete('/:id', requireAuth, requireScope(SCOPES.LOG_DRAINS.DELETE), auditLog('LOG_DRAIN_DELETE', { getResource: (req) => `${req.params.name}/${req.params.id}` }), async (req, res) => {
    try {
      const { name, id } = req.params as { name: string; id: string };
      const instance = await instanceManager.getInstance(name);
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      const drain = await prisma.logDrain.findFirst({ where: { id, instanceId: instance.id } });
      if (!drain) return res.status(404).json({ error: 'Drain not found' });

      await prisma.logDrain.delete({ where: { id } });
      return res.json({ message: 'Drain deleted' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
