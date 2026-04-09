import { Router, Request, Response } from 'express';
import { ExternalStorageService } from '../services/ExternalStorageService';
import prisma from '../lib/prisma';
import { requireViewer, requireAdmin } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';
import { z } from 'zod';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';

const DestinationConfigSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['sftp', 's3', 'googledrive', 'onedrive', 'webdav']),
  config: z.record(z.any()),
  enabled: z.boolean().optional(),
});

export function createBackupDestinationRoutes() {
  const router = Router();

  /**
   * GET /api/backup-destinations
   * List all configured destinations (config/credentials never exposed)
   */
  router.get('/', requireViewer, requireScope(SCOPES.BACKUP_DESTINATIONS.READ), async (_req: Request, res: Response) => {
    try {
      const destinations = await ExternalStorageService.listDestinations();
      res.json(destinations);
    } catch (error) {
      logger.error('Error listing backup destinations:', error);
      res.status(500).json({ error: 'Failed to list backup destinations' });
    }
  });

  /**
   * POST /api/backup-destinations
   * Create a new destination
   */
  router.post('/', requireAdmin, requireScope(SCOPES.BACKUP_DESTINATIONS.CREATE), async (req: Request, res: Response): Promise<any> => {
    try {
      const parsed = DestinationConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const user = (req as any).user;
      const destination = await ExternalStorageService.createDestination({
        ...parsed.data,
        createdBy: user.id,
      });

      res.status(201).json({
        id: destination.id,
        name: destination.name,
        type: destination.type,
        enabled: destination.enabled,
        createdAt: destination.createdAt,
      });
    } catch (error: any) {
      logger.error('Error creating backup destination:', error);
      res.status(500).json({ error: error.message || 'Failed to create backup destination' });
    }
  });

  /**
   * GET /api/backup-destinations/:id
   * Get destination metadata (config masked — only provider-specific non-secret fields returned)
   */
  router.get('/:id', requireViewer, requireScope(SCOPES.BACKUP_DESTINATIONS.READ), async (req: Request, res: Response): Promise<any> => {
    try {
      const destinations = await ExternalStorageService.listDestinations();
      const dest = destinations.find((d) => d.id === req.params.id);
      if (!dest) return res.status(404).json({ error: 'Destination not found' });
      res.json(dest);
    } catch (error) {
      logger.error('Error fetching backup destination:', error);
      res.status(500).json({ error: 'Failed to fetch backup destination' });
    }
  });

  /**
   * PUT /api/backup-destinations/:id
   * Update destination (partial update — only provided fields are changed)
   */
  router.put('/:id', requireAdmin, requireScope(SCOPES.BACKUP_DESTINATIONS.UPDATE), async (req: Request, res: Response): Promise<any> => {
    try {
      const UpdateSchema = DestinationConfigSchema.partial();
      const parsed = UpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      // Verify destination exists
      const existing = await prisma.backupDestination.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Destination not found' });

      const updated = await ExternalStorageService.updateDestination(req.params.id, parsed.data);
      res.json({ id: updated.id, name: updated.name, type: updated.type, enabled: updated.enabled });
    } catch (error) {
      logger.error('Error updating backup destination:', error);
      res.status(500).json({ error: 'Failed to update backup destination' });
    }
  });

  /**
   * DELETE /api/backup-destinations/:id
   */
  router.delete('/:id', requireAdmin, requireScope(SCOPES.BACKUP_DESTINATIONS.DELETE), async (req: Request, res: Response): Promise<any> => {
    try {
      const existing = await prisma.backupDestination.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Destination not found' });

      await prisma.backupDestination.delete({ where: { id: req.params.id } });
      res.json({ message: 'Destination deleted' });
    } catch (error) {
      logger.error('Error deleting backup destination:', error);
      res.status(500).json({ error: 'Failed to delete backup destination' });
    }
  });

  /**
   * POST /api/backup-destinations/:id/test
   * Test connectivity to the destination
   */
  router.post('/:id/test', requireAdmin, requireScope(SCOPES.BACKUP_DESTINATIONS.TEST), async (req: Request, res: Response): Promise<any> => {
    try {
      const existing = await prisma.backupDestination.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Destination not found' });

      const result = await ExternalStorageService.testDestination(req.params.id);
      res.json(result);
    } catch (error: any) {
      logger.error('Error testing backup destination:', error);
      res.status(500).json({ success: false, error: error.message || 'Test failed' });
    }
  });

  return router;
}
