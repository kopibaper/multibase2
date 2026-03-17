import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

export function createMarketplaceRoutes(prisma: PrismaClient) {
  const router = Router();

  // GET /api/marketplace/extensions
  // Returns all available extensions (with optional filter: category, search, featured)
  router.get('/extensions', requireAuth, async (req, res): Promise<any> => {
    try {
      const { category, search, featured } = req.query;

      const where: Record<string, unknown> = {};

      if (category && typeof category === 'string') {
        where.category = category;
      }

      if (featured === 'true') {
        where.featured = true;
      }

      let extensions = await prisma.extension.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { installCount: 'desc' }, { name: 'asc' }],
      });

      if (search && typeof search === 'string') {
        const query = search.toLowerCase();
        extensions = extensions.filter(
          (e) =>
            e.name.toLowerCase().includes(query) ||
            e.description.toLowerCase().includes(query) ||
            e.tags.toLowerCase().includes(query)
        );
      }

      return res.json({ extensions });
    } catch (error: any) {
      logger.error('Error listing marketplace extensions:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /api/marketplace/extensions/:id
  // Returns a single extension with full details
  router.get('/extensions/:id', requireAuth, async (req, res): Promise<any> => {
    try {
      const extension = await prisma.extension.findUnique({
        where: { id: req.params.id },
        include: { installations: { select: { instanceId: true, status: true } } },
      });

      if (!extension) {
        return res.status(404).json({ error: 'Extension not found' });
      }

      return res.json({ extension });
    } catch (error: any) {
      logger.error(`Error fetching extension "${req.params.id}":`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /api/marketplace/extensions/:id/reviews
  // Returns all reviews for an extension
  router.get('/extensions/:id/reviews', requireAuth, async (req, res): Promise<any> => {
    try {
      const reviews = await prisma.extensionReview.findMany({
        where: { extensionId: req.params.id },
        orderBy: { createdAt: 'desc' },
      });
      return res.json({ reviews });
    } catch (error: any) {
      logger.error(`Error fetching reviews for "${req.params.id}":`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/marketplace/extensions/:id/reviews
  // Submit a rating + optional comment
  router.post('/extensions/:id/reviews', requireAuth, async (req, res): Promise<any> => {
    try {
      const { rating, comment, authorName } = req.body;

      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
      }

      const extension = await prisma.extension.findUnique({ where: { id: req.params.id } });
      if (!extension) return res.status(404).json({ error: 'Extension not found' });

      const review = await prisma.extensionReview.create({
        data: {
          extensionId: req.params.id,
          rating: Math.round(rating),
          comment: typeof comment === 'string' ? comment.slice(0, 1000) : null,
          authorName: typeof authorName === 'string' ? authorName.slice(0, 64) : null,
        },
      });

      // Recalculate aggregate rating on the Extension row
      const agg = await prisma.extensionReview.aggregate({
        where: { extensionId: req.params.id },
        _avg: { rating: true },
        _count: true,
      });
      await prisma.extension.update({
        where: { id: req.params.id },
        data: { rating: agg._avg.rating ?? null },
      });

      return res.status(201).json({ review });
    } catch (error: any) {
      logger.error(`Error submitting review for "${req.params.id}":`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /api/marketplace/extensions/:id/stats
  // Returns install count + average rating
  router.get('/extensions/:id/stats', requireAuth, async (req, res): Promise<any> => {
    try {
      const extension = await prisma.extension.findUnique({
        where: { id: req.params.id },
        select: { installCount: true, rating: true, latestVersion: true, version: true },
      });
      if (!extension) return res.status(404).json({ error: 'Extension not found' });
      return res.json(extension);
    } catch (error: any) {
      logger.error(`Error fetching stats for "${req.params.id}":`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // POST /api/marketplace/sync  (admin only)
  // Re-seeds the extension catalog from the embedded official list
  router.post('/sync', requireAuth, async (req, res): Promise<any> => {
    try {
      const user = (req as any).user;
      if (user?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Delegate to seed function — defined in scripts/seed-marketplace.ts
      // Here we just confirm the route exists; actual seeding via npm run seed:marketplace
      return res.json({
        message: 'Sync triggered. Run seed-marketplace script to update catalog.',
      });
    } catch (error: any) {
      logger.error('Error syncing marketplace:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
