import { Router } from 'express';
import { InstanceManager } from '../services/InstanceManager';
import DockerManager from '../services/DockerManager';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';
import { auditLog } from '../middleware/auditLog';

export function createRealtimeRoutes(
  instanceManager: InstanceManager,
  dockerManager: DockerManager
) {
  const router = Router({ mergeParams: true });

  /** GET /config — Realtime service config + container status */
  router.get('/config', requireAuth, requireScope(SCOPES.REALTIME.READ), async (req, res) => {
    try {
      const { name } = req.params;
      const env = await instanceManager.getInstanceEnv(name);

      // Check if realtime container is running
      const containers = await dockerManager.listProjectContainers(name);
      const realtimeContainer = containers.find((c) =>
        c.Names.some((n) => n.includes('realtime'))
      );
      const realtimeRunning = realtimeContainer
        ? realtimeContainer.State === 'running'
        : false;

      return res.json({
        maxConcurrentUsers: parseInt(env['REALTIME_MAX_CONCURRENT_USERS'] || '200', 10),
        tenantId: env['REALTIME_TENANT_ID'] || 'realtime-dev',
        jwtSecretSet: !!env['JWT_SECRET'],
        realtimeEnabled: realtimeRunning,
        apiUrl: env['API_EXTERNAL_URL'] || '',
        anonKey: env['ANON_KEY'] || '',
      });
    } catch (err: any) {
      logger.error(`realtime.getConfig error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  /** PATCH /config — Update maxConcurrentUsers and restart realtime container */
  router.patch('/config', requireAuth, requireScope(SCOPES.REALTIME.WRITE), auditLog('REALTIME_CONFIG_UPDATE', { includeBody: true, getResource: (req) => req.params.name }), async (req, res) => {
    try {
      const { name } = req.params;
      const { maxConcurrentUsers } = req.body;

      if (maxConcurrentUsers !== undefined) {
        const val = parseInt(maxConcurrentUsers, 10);
        if (isNaN(val) || val < 10 || val > 10000) {
          return res
            .status(400)
            .json({ error: 'maxConcurrentUsers must be between 10 and 10000' });
        }
        await instanceManager.updateInstanceConfig(name, {
          REALTIME_MAX_CONCURRENT_USERS: String(val),
        });
      }

      // Restart just the realtime container
      const containers = await dockerManager.listProjectContainers(name);
      const realtimeContainer = containers.find((c) =>
        c.Names.some((n) => n.includes('realtime'))
      );
      if (realtimeContainer) {
        const container = (dockerManager as any).docker.getContainer(realtimeContainer.Id);
        await container.restart({ t: 10 });
        logger.info(`Restarted realtime container for ${name}`);
      }

      return res.json({ success: true, message: 'Realtime config updated and container restarted.' });
    } catch (err: any) {
      logger.error(`realtime.updateConfig error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  /** GET /stats — Live stats: channel count + container CPU/memory */
  router.get('/stats', requireAuth, requireScope(SCOPES.REALTIME.READ), async (req, res) => {
    try {
      const { name } = req.params;

      // Channel count via SQL (graceful fallback if realtime schema not ready)
      let channelCount = 0;
      try {
        const result = await instanceManager.executeSQL(
          name,
          `SELECT COUNT(*)::int AS channel_count FROM realtime.channels`
        );
        if (result.rows?.[0]?.channel_count !== undefined) {
          channelCount = Number(result.rows[0].channel_count);
        }
      } catch {
        // realtime.channels may not exist — ignore
      }

      // Container CPU/memory
      const containers = await dockerManager.listProjectContainers(name);
      const realtimeContainer = containers.find((c) =>
        c.Names.some((n) => n.includes('realtime'))
      );

      let cpu = 0;
      let memory = 0;
      let status = 'stopped';

      if (realtimeContainer) {
        status = realtimeContainer.State === 'running' ? 'running' : 'stopped';
        if (realtimeContainer.State === 'running') {
          const stats = await dockerManager.getContainerStats(realtimeContainer.Id);
          cpu = stats?.cpu ?? 0;
          memory = stats?.memory ?? 0;
        }
      }

      return res.json({ channelCount, cpu, memory, status });
    } catch (err: any) {
      logger.error(`realtime.getStats error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
