import { Router, Request, Response } from 'express';
import { UptimeService } from '../services/UptimeService';
import { requireViewer } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';

export function createUptimeRoutes(uptimeService: UptimeService): Router {
  const router = Router();

  /**
   * GET /api/instances/:name/uptime
   * Get uptime statistics for an instance
   * Query params: days (default 30)
   */
  router.get('/:name/uptime', requireViewer, requireScope(SCOPES.UPTIME.READ), async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const stats = await uptimeService.getUptimeStats(name, days);
      res.json(stats);
    } catch (error: any) {
      logger.error(`Error getting uptime stats for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to get uptime stats' });
    }
  });

  return router;
}
