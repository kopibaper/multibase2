/**
 * Studio Routes - Tenant activation for Shared Studio
 *
 * POST /api/studio/activate/:tenantName  - Switch Studio to a tenant
 * GET  /api/studio/active                - Get currently active tenant
 * POST /api/studio/deactivate            - Deactivate Studio
 */

import { Router, Request, Response } from 'express';
import { StudioManager } from '../services/StudioManager';
import { logger } from '../utils/logger';
import { auditLog } from '../middleware/auditLog';

export function createStudioRoutes(studioManager: StudioManager): Router {
  const router = Router();

  /**
   * POST /api/studio/activate/:tenantName
   * Switches the shared Studio + Nginx Gateway + pg-meta to serve the specified tenant.
   * Takes ~3-5 seconds (Nginx reload + pg-meta restart).
   */
  router.post('/activate/:tenantName', auditLog('STUDIO_TENANT_ACTIVATE', { getResource: (req) => req.params.tenantName }), async (req: Request, res: Response): Promise<any> => {
    try {
      const { tenantName } = req.params;

      if (!tenantName || !/^[a-z0-9-]+$/.test(tenantName)) {
        return res.status(400).json({
          error: 'Invalid tenant name. Use lowercase letters, numbers, and hyphens only.',
        });
      }

      // Check if switch is already in progress
      if (studioManager.isSwitching()) {
        return res.status(409).json({
          error: 'Tenant switch already in progress',
          message: 'Please wait for the current switch to complete.',
        });
      }

      logger.info(`Studio activation requested for tenant: ${tenantName}`);
      const activeTenant = await studioManager.activateTenant(tenantName);
      const studioUrl = studioManager.getStudioUrl(tenantName, req.hostname);

      res.json({
        success: true,
        activeTenant: {
          name: activeTenant.name,
          projectDb: activeTenant.projectDb,
          activatedAt: activeTenant.activatedAt,
        },
        studioUrl: studioUrl || `http://${req.hostname}:3000`,
        message: `Studio is now connected to "${tenantName}"`,
      });
    } catch (error: any) {
      logger.error('Studio activation failed:', error);
      res.status(500).json({
        error: 'Failed to activate tenant for Studio',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/studio/active
   * Returns the currently active tenant for Studio.
   */
  router.get('/active', (_req: Request, res: Response) => {
    const activeTenant = studioManager.getActiveTenant();

    if (!activeTenant) {
      res.json({
        active: false,
        message: 'No tenant is currently active for Studio',
      });
      return;
    }

    res.json({
      active: true,
      tenant: {
        name: activeTenant.name,
        projectDb: activeTenant.projectDb,
        activatedAt: activeTenant.activatedAt,
      },
    });
  });

  /**
   * POST /api/studio/heartbeat/:tenantName
   * Resets the idle timer for the tenant's Studio.
   * Called periodically by the frontend while the Studio tab is open.
   */
  router.post('/heartbeat/:tenantName', (req: Request, res: Response) => {
    const { tenantName } = req.params;
    if (tenantName && /^[a-z0-9-]+$/.test(tenantName)) {
      studioManager.keepAlive(tenantName);
    }
    res.status(204).send();
  });

  /**
   * POST /api/studio/deactivate
   * Deactivates the current tenant from Studio.
   */
  router.post('/deactivate', auditLog('STUDIO_DEACTIVATE'), async (_req: Request, res: Response) => {
    try {
      await studioManager.deactivate();
      res.json({ success: true, message: 'Studio deactivated' });
    } catch (error: any) {
      logger.error('Studio deactivation failed:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
