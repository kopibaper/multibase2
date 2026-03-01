/**
 * Shared Infrastructure API Routes (Cloud-Version)
 *
 * Endpoints for managing the shared infrastructure:
 * - GET  /api/shared/status    - Status of shared services
 * - POST /api/shared/start     - Start shared infrastructure
 * - POST /api/shared/stop      - Stop shared infrastructure
 * - GET  /api/shared/databases - List project databases
 * - POST /api/shared/databases - Create project database
 * - DELETE /api/shared/databases/:name - Drop project database
 */

import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import DockerManager from '../services/DockerManager';
import { StudioManager } from '../services/StudioManager';
import { logger } from '../utils/logger';
import { parseEnvFile } from '../utils/envParser';
import { requireAuth } from '../middleware/authMiddleware';

const execAsync = promisify(exec);

export function createSharedRoutes(
  dockerManager: DockerManager,
  studioManager?: StudioManager
): Router {
  const router = Router();

  // All shared infrastructure endpoints require a valid session
  router.use(requireAuth);

  const getSharedDir = () => {
    const projectsPath = process.env.PROJECTS_PATH || path.join(__dirname, '../../../projects');
    return path.resolve(projectsPath, '..', 'shared');
  };

  const getSharedEnv = () => {
    const sharedDir = getSharedDir();
    const envPath = path.join(sharedDir, '.env.shared');
    if (fs.existsSync(envPath)) {
      return parseEnvFile(envPath);
    }
    return null;
  };

  const getSharedPgPool = () => {
    const sharedEnv = getSharedEnv();
    return new Pool({
      host: '127.0.0.1',
      port: parseInt(sharedEnv?.SHARED_PG_PORT || '5432', 10),
      user: 'postgres',
      password: sharedEnv?.SHARED_POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD,
      database: 'postgres',
      connectionTimeoutMillis: 5000,
    });
  };

  /**
   * GET /api/shared/status
   * Returns status of all shared infrastructure services
   */
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const services = await dockerManager.getSharedServiceStatus();
      const sharedEnv = getSharedEnv();

      const running = services.filter((s) => s.status === 'running').length;
      const total = services.length;
      let status: 'running' | 'stopped' | 'degraded' = 'stopped';
      if (running === total && total > 0) status = 'running';
      else if (running > 0) status = 'degraded';

      const ports = {
        postgres: parseInt(sharedEnv?.SHARED_PG_PORT || '5432', 10),
        studio: parseInt(sharedEnv?.STUDIO_PORT || '3000', 10),
        analytics: parseInt(sharedEnv?.ANALYTICS_PORT || '4000', 10),
        pooler: parseInt(sharedEnv?.POOLER_PORT || '6543', 10),
        gateway: parseInt(
          sharedEnv?.SHARED_GATEWAY_PORT || sharedEnv?.KONG_HTTP_PORT || '8000',
          10
        ),
        meta: parseInt(sharedEnv?.META_PORT || '8080', 10),
      };

      res.json({
        status,
        services,
        ports,
        totalServices: total,
        runningServices: running,
        activeTenant: studioManager?.getActiveTenant() || null,
      });
    } catch (error: any) {
      logger.error('Error getting shared status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/shared/start
   * Start shared infrastructure via docker compose
   */
  router.post('/start', async (_req: Request, res: Response) => {
    try {
      const sharedDir = getSharedDir();
      const composePath = path.join(sharedDir, 'docker-compose.shared.yml');

      if (!fs.existsSync(composePath)) {
        res.status(400).json({ error: 'shared/docker-compose.shared.yml nicht gefunden' });
        return;
      }

      logger.info('Starting shared infrastructure...');
      const { stdout, stderr } = await execAsync(
        'docker compose -f docker-compose.shared.yml --env-file .env.shared up -d',
        { cwd: sharedDir }
      );

      logger.info(`Shared start output: ${stdout}`);
      if (stderr) logger.warn(`Shared start stderr: ${stderr}`);

      res.json({ success: true, message: 'Shared Infrastructure gestartet', output: stdout });
    } catch (error: any) {
      logger.error('Error starting shared infrastructure:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/shared/stop
   * Stop shared infrastructure
   */
  router.post('/stop', async (_req: Request, res: Response) => {
    try {
      const sharedDir = getSharedDir();

      logger.info('Stopping shared infrastructure...');
      const { stdout } = await execAsync(
        'docker compose -f docker-compose.shared.yml --env-file .env.shared down',
        { cwd: sharedDir }
      );

      res.json({ success: true, message: 'Shared Infrastructure gestoppt', output: stdout });
    } catch (error: any) {
      logger.error('Error stopping shared infrastructure:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/shared/databases
   * List all project databases in the shared cluster
   * Uses docker exec to avoid Docker Desktop Windows TCP auth issues
   */
  router.get('/databases', async (_req: Request, res: Response) => {
    const pool = getSharedPgPool();
    try {
      const result = await pool.query(
        `SELECT datname, pg_database_size(datname) as size_bytes FROM pg_database WHERE datname LIKE 'project_%' ORDER BY datname`
      );

      const databases = result.rows.map((row) => {
        const bytes = parseInt(row.size_bytes, 10) || 0;
        return {
          name: row.datname,
          projectName: row.datname.replace('project_', '').replace(/_/g, '-'),
          sizeBytes: bytes,
          sizeFormatted: formatBytes(bytes),
        };
      });

      res.json({ databases, count: databases.length });
    } catch (error: any) {
      logger.error('Error listing databases:', error);
      res.status(500).json({ error: error.message });
    } finally {
      await pool.end();
    }
  });

  /**
   * POST /api/shared/databases
   * Create a new project database
   * Uses docker exec to avoid Docker Desktop Windows TCP auth issues
   */
  router.post('/databases', async (req: Request, res: Response) => {
    try {
      const { projectName } = req.body;
      if (!projectName) {
        res.status(400).json({ error: 'projectName required' });
        return;
      }

      const dbName = `project_${projectName}`.replace(/-/g, '_');
      const createPool = getSharedPgPool();
      try {
        await createPool.query(`CREATE DATABASE ${dbName}`);
      } finally {
        await createPool.end();
      }

      logger.info(`Created database: ${dbName}`);
      res.json({ success: true, database: dbName });
    } catch (error: any) {
      logger.error('Error creating database:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/shared/databases/:name
   * Drop a project database
   * Uses docker exec to avoid Docker Desktop Windows TCP auth issues
   */
  router.delete('/databases/:name', async (req: Request, res: Response) => {
    try {
      const dbName = `project_${req.params.name}`.replace(/-/g, '_');

      // Terminate active connections first, then drop
      const dropPool = getSharedPgPool();
      try {
        await dropPool.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()`,
          [dbName]
        );
        await dropPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
      } finally {
        await dropPool.end();
      }

      logger.info(`Dropped database: ${dbName}`);
      res.json({ success: true, database: dbName });
    } catch (error: any) {
      logger.error('Error dropping database:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default createSharedRoutes;
