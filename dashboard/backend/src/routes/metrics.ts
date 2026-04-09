import { Router, Request, Response } from 'express';
import * as os from 'os';
import { execSync } from 'child_process';
import MetricsCollector from '../services/MetricsCollector';
import { RedisCache } from '../services/RedisCache';
import { logger } from '../utils/logger';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';

function getHostDiskInfo(): { totalMB: number; usedMB: number } | null {
  try {
    if (process.platform === 'win32') {
      const drive = process.cwd().slice(0, 1);
      const out = execSync(
        `powershell -Command "$d = Get-PSDrive ${drive}; Write-Output (($d.Used + $d.Free).ToString()); Write-Output $d.Used.ToString()"`,
        { timeout: 4000 }
      )
        .toString()
        .replace(/\r/g, '')
        .trim()
        .split('\n');
      const totalMB = Math.round(parseInt(out[0]) / 1024 / 1024);
      const usedMB = Math.round(parseInt(out[1]) / 1024 / 1024);
      if (!isNaN(totalMB) && !isNaN(usedMB)) return { totalMB, usedMB };
    } else {
      const out = execSync('df -m / | tail -1', { timeout: 3000 }).toString().trim().split(/\s+/);
      const totalMB = parseInt(out[1]);
      const usedMB = parseInt(out[2]);
      if (!isNaN(totalMB) && !isNaN(usedMB)) return { totalMB, usedMB };
    }
  } catch {
    // ignore – disk info is optional
  }
  return null;
}

export function createMetricsRoutes(
  metricsCollector: MetricsCollector,
  redisCache: RedisCache
): Router {
  const router = Router();

  /**
   * GET /api/metrics/system
   * Get system-wide metrics
   */
  router.get('/system', requireScope(SCOPES.METRICS.READ), async (req: Request, res: Response) => {
    try {
      const { since, limit } = req.query;

      const sinceDate = since ? new Date(since as string) : undefined;
      const limitNum = limit ? parseInt(limit as string, 10) : 100;

      const metrics = await metricsCollector.getSystemMetricsHistory(sinceDate, limitNum);
      // Return the latest metric (last in array) for current system state
      const latestMetric =
        metrics.length > 0
          ? metrics[metrics.length - 1]
          : {
              totalCpu: 0,
              totalMemory: 0,
              instanceCount: 0,
              runningCount: 0,
              timestamp: new Date(),
            };
      // Immer aktuelles Host-RAM und Disk-Info anhängen (dynamisch, plattformunabhängig)
      const hostTotalMemoryMB = Math.round(os.totalmem() / 1024 / 1024);
      const diskInfo = getHostDiskInfo();
      res.json({
        ...latestMetric,
        hostTotalMemory: hostTotalMemoryMB,
        hostDiskTotal: diskInfo?.totalMB ?? null,
        hostDiskUsed: diskInfo?.usedMB ?? null,
      });
    } catch (error) {
      logger.error('Error getting system metrics:', error);
      res.status(500).json({ error: 'Failed to get system metrics' });
    }
  });

  /**
   * GET /api/metrics/instances/:name
   * Get latest metrics for an instance (from Redis cache)
   */
  router.get('/instances/:name', requireScope(SCOPES.METRICS.READ), async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const metricsMap = await redisCache.getAllMetrics(name);

      const metrics: any = {};
      metricsMap.forEach((value, key) => {
        metrics[key] = value;
      });

      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting metrics for instance ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get instance metrics' });
    }
  });

  /**
   * GET /api/metrics/instances/:name/history
   * Get historical metrics for an instance
   */
  router.get('/instances/:name/history', requireScope(SCOPES.METRICS.READ), async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { service, since, limit, hours } = req.query;

      let sinceDate: Date | undefined;

      // Support both 'hours' and 'since' parameters
      if (hours) {
        const hoursNum = parseFloat(hours as string);
        sinceDate = new Date(Date.now() - hoursNum * 60 * 60 * 1000);
      } else if (since) {
        sinceDate = new Date(since as string);
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 100;

      const metrics = await metricsCollector.getHistoricalMetrics(
        name,
        service as string | undefined,
        sinceDate,
        limitNum
      );

      res.json(metrics);
    } catch (error) {
      logger.error(`Error getting historical metrics for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get historical metrics' });
    }
  });

  /**
   * GET /api/metrics/instances/:name/services/:service
   * Get metrics for a specific service
   */
  router.get(
    '/instances/:name/services/:service',
    requireScope(SCOPES.METRICS.READ),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const { name, service } = req.params;
        const metrics = await redisCache.getMetrics(name, service);

        if (!metrics) {
          return res.status(404).json({ error: 'Metrics not found' });
        }

        res.json(metrics);
      } catch (error) {
        logger.error(`Error getting metrics for ${req.params.name}:${req.params.service}:`, error);
        res.status(500).json({ error: 'Failed to get service metrics' });
      }
    }
  );

  return router;
}
