import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { feedbackLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { FeedbackSchema } from '../middleware/schemas';
import { requireAdmin } from '../middleware/authMiddleware';
import { logger } from '../utils/logger';

export function createFeedbackRoutes(prisma: PrismaClient) {
  const router = Router();

  /**
   * GET /api/feedback
   * Public: returns open/in_progress submissions.
   * Strips ipAddress and authorEmail from response.
   */
  router.get('/', async (req, res): Promise<any> => {
    try {
      // ?all=true is only useful for admins — non-admins always see only open/in_progress
      const showAll = req.query.all === 'true';
      const where = showAll ? {} : { status: { in: ['open', 'in_progress'] } };

      const items = await prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          urgency: true,
          authorName: true,
          status: true,
          createdAt: true,
        },
      });
      return res.json({ feedback: items });
    } catch (error: any) {
      logger.error('Error fetching feedback:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/feedback
   * Public: rate-limited, honeypot-validated, Zod-validated.
   */
  router.post('/', feedbackLimiter, validate(FeedbackSchema), async (req, res): Promise<any> => {
    try {
      const { type, title, description, urgency, authorName, authorEmail } = req.body;
      const ip = req.ip ?? (req.socket?.remoteAddress ?? null);

      const item = await prisma.feedback.create({
        data: {
          type,
          title,
          description,
          urgency,
          authorName: authorName || null,
          authorEmail: authorEmail || null,
          ipAddress: ip,
        },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          urgency: true,
          authorName: true,
          status: true,
          createdAt: true,
        },
      });

      logger.info(`New feedback submitted: [${type}] ${title} (IP: ${ip})`);
      return res.status(201).json({ feedback: item });
    } catch (error: any) {
      logger.error('Error submitting feedback:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  /**
   * PATCH /api/feedback/:id
   * Admin only: update status of a feedback item.
   */
  router.patch('/:id', requireAdmin, async (req, res): Promise<any> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

      const { status } = req.body;
      const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      }

      const item = await prisma.feedback.update({
        where: { id },
        data: { status },
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          urgency: true,
          authorName: true,
          status: true,
          createdAt: true,
        },
      });

      logger.info(`Feedback #${id} status updated to "${status}" by admin`);
      return res.json({ feedback: item });
    } catch (error: any) {
      if (error.code === 'P2025') return res.status(404).json({ error: 'Feedback not found' });
      logger.error('Error updating feedback:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
