import { Router } from 'express';
import { CronService } from '../services/CronService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

export function createCronRoutes(cronService: CronService) {
  const router = Router({ mergeParams: true });

  // Extension status
  router.get('/status', requireAuth, async (req, res) => {
    try {
      const status = await cronService.getStatus(req.params.name);
      return res.json(status);
    } catch (error: any) {
      logger.error(`Error getting cron status for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // List all cron jobs
  router.get('/', requireAuth, async (req, res) => {
    try {
      const result = await cronService.listJobs(req.params.name);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error listing cron jobs for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Create a cron job
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { name, schedule, command } = req.body;
      if (!name || !schedule || !command) {
        return res.status(400).json({ error: 'name, schedule, and command are required' });
      }
      const result = await cronService.createJob(req.params.name, { name, schedule, command });
      return res.status(201).json(result);
    } catch (error: any) {
      logger.error(`Error creating cron job for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Delete a cron job
  router.delete('/:jobId', requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId, 10);
      if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid job ID' });

      const result = await cronService.deleteJob(req.params.name, jobId);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error deleting cron job ${req.params.jobId}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Toggle job active/inactive
  router.patch('/:jobId', requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId, 10);
      if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid job ID' });
      const { active } = req.body;
      if (typeof active !== 'boolean') return res.status(400).json({ error: 'active (boolean) is required' });

      const result = await cronService.toggleJob(req.params.name, jobId, active);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error toggling cron job ${req.params.jobId}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Run a job immediately
  router.post('/:jobId/run', requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId, 10);
      if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid job ID' });

      const result = await cronService.runJobNow(req.params.name, jobId);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error running cron job ${req.params.jobId}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Get run history for a job
  router.get('/:jobId/runs', requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId, 10);
      if (isNaN(jobId)) return res.status(400).json({ error: 'Invalid job ID' });
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const runs = await cronService.getJobRuns(req.params.name, jobId, limit);
      return res.json({ runs });
    } catch (error: any) {
      logger.error(`Error fetching runs for cron job ${req.params.jobId}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
