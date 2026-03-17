import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { ExtensionService } from '../services/ExtensionService';
import InstanceManager from '../services/InstanceManager';
import { RedisCache } from '../services/RedisCache';
import { FunctionService } from '../services/FunctionService';
import { logger } from '../utils/logger';
import { createAuditLogEntry } from '../middleware/auditLog';

// Simple in-memory rate limiter: max 3 installs per instance per hour
const installLimiter = new Map<string, { count: number; resetAt: number }>();

function checkInstallRateLimit(instanceName: string): void {
  const now = Date.now();
  const entry = installLimiter.get(instanceName);
  if (!entry || entry.resetAt < now) {
    installLimiter.set(instanceName, { count: 1, resetAt: now + 3_600_000 });
    return;
  }
  if (entry.count >= 3) {
    throw new Error('Rate limit exceeded: max 3 installations per instance per hour');
  }
  entry.count += 1;
}

export function createExtensionRoutes(
  prisma: PrismaClient,
  instanceManager: InstanceManager,
  redisCache: RedisCache,
  functionService: FunctionService
) {
  const router = Router({ mergeParams: true });
  const extensionService = new ExtensionService(prisma, instanceManager, redisCache, functionService);

  // GET /api/instances/:name/extensions
  // Lists all installed extensions for an instance
  router.get('/', requireAuth, async (req, res): Promise<any> => {
    try {
      const { name } = req.params;

      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      const installed = await prisma.installedExtension.findMany({
        where: { instanceId: instance.id },
        include: {
          extension: {
            select: {
              id: true,
              name: true,
              description: true,
              version: true,
              author: true,
              category: true,
              iconUrl: true,
              verified: true,
              latestVersion: true,
            },
          },
        },
        orderBy: { installedAt: 'desc' },
      });

      return res.json({ extensions: installed });
    } catch (error: any) {
      logger.error(`Error listing installed extensions for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/instances/:name/extensions
  // Install an extension on an instance
  router.post('/', requireAuth, async (req, res): Promise<any> => {
    try {
      const { name } = req.params;
      const { extensionId, config = {} } = req.body;

      if (!extensionId || typeof extensionId !== 'string') {
        return res.status(400).json({ error: 'extensionId is required' });
      }

      checkInstallRateLimit(name);

      await extensionService.install(name, extensionId, config);

      const instance = await prisma.instance.findUnique({ where: { name } });
      const installed = instance
        ? await prisma.installedExtension.findUnique({
            where: { instanceId_extensionId: { instanceId: instance.id, extensionId } },
            include: { extension: true },
          })
        : null;

      // Note: installCount is already incremented inside ExtensionService.install()

      await createAuditLogEntry({
        userId: (req as any).user?.id || null,
        action: 'EXTENSION_INSTALL',
        resource: `instance/${name}/extensions/${extensionId}`,
        details: { extensionId, instanceName: name },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        success: true,
      });

      return res.status(201).json({ installed });
    } catch (error: any) {
      logger.error(`Error installing extension "${req.body.extensionId}" on "${req.params.name}":`, error);
      const status = error.message?.includes('Rate limit') ? 429
        : error.message?.includes('already installed') ? 409
        : 500;
      return res.status(status).json({ error: error.message });
    }
  });

  // DELETE /api/instances/:name/extensions/:extensionId
  // Uninstall an extension
  router.delete('/:extensionId', requireAuth, async (req, res): Promise<any> => {
    try {
      const { name, extensionId } = req.params;
      await extensionService.uninstall(name, extensionId);

      // Decrement install counter (floor at 0)
      await prisma.extension.updateMany({
        where: { id: extensionId, installCount: { gt: 0 } },
        data: { installCount: { decrement: 1 } },
      }).catch(() => { /* ignore */ });

      await createAuditLogEntry({
        userId: (req as any).user?.id || null,
        action: 'EXTENSION_UNINSTALL',
        resource: `instance/${name}/extensions/${extensionId}`,
        details: { extensionId, instanceName: name },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
        success: true,
      });

      return res.json({ success: true });
    } catch (error: any) {
      logger.error(`Error uninstalling extension "${req.params.extensionId}" from "${req.params.name}":`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /api/instances/:name/extensions/:extensionId/status
  // Returns status of a single installed extension
  router.get('/:extensionId/status', requireAuth, async (req, res): Promise<any> => {
    try {
      const { name, extensionId } = req.params;

      const instance = await prisma.instance.findUnique({ where: { name } });
      if (!instance) return res.status(404).json({ error: 'Instance not found' });

      const installed = await prisma.installedExtension.findUnique({
        where: { instanceId_extensionId: { instanceId: instance.id, extensionId } },
        include: { extension: { select: { name: true, version: true } } },
      });

      if (!installed) return res.status(404).json({ error: 'Extension not installed' });

      return res.json({
        status: installed.status,
        version: installed.version,
        installedAt: installed.installedAt,
        config: installed.config ? JSON.parse(installed.config) : {},
      });
    } catch (error: any) {
      logger.error(`Error getting extension status for "${req.params.extensionId}":`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
