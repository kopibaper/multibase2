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
import DockerManager from '../services/DockerManager';
import { logger } from '../utils/logger';
import { parseEnvFile } from '../utils/envParser';

const execAsync = promisify(exec);

export function createSharedRoutes(dockerManager: DockerManager): Router {
  const router = Router();

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

  /**
   * GET /api/shared/status
   * Returns status of all shared infrastructure services
   */
  router.get('/status', async (_req: Request, res: Response) => {
    try {
      const services = await dockerManager.getSharedServiceStatus();
      const sharedEnv = getSharedEnv();

      const running = services.filter(s => s.status === 'running').length;
      const total = services.length;
      let status: 'running' | 'stopped' | 'degraded' = 'stopped';
      if (running === total && total > 0) status = 'running';
      else if (running > 0) status = 'degraded';

      const ports = {
        postgres: parseInt(sharedEnv?.SHARED_PG_PORT || '5432', 10),
        studio: parseInt(sharedEnv?.STUDIO_PORT || '3000', 10),
        analytics: parseInt(sharedEnv?.ANALYTICS_PORT || '4000', 10),
        pooler: parseInt(sharedEnv?.POOLER_PORT || '6543', 10),
        kong: parseInt(sharedEnv?.KONG_HTTP_PORT || '8000', 10),
        meta: parseInt(sharedEnv?.META_PORT || '8080', 10),
      };

      res.json({
        status,
        services,
        ports,
        totalServices: total,
        runningServices: running,
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
   */
  router.get('/databases', async (_req: Request, res: Response) => {
    try {
      const sharedEnv = getSharedEnv();
      if (!sharedEnv) {
        res.status(400).json({ error: 'Shared configuration not found' });
        return;
      }

      const port = sharedEnv.SHARED_PG_PORT || '5432';
      const password = sharedEnv.SHARED_POSTGRES_PASSWORD;

      const { Client } = await import('pg');
      const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'postgres',
        password,
        port: parseInt(port, 10),
      });

      await client.connect();
      const result = await client.query(`
        SELECT datname, pg_database_size(datname) as size_bytes
        FROM pg_database 
        WHERE datname LIKE 'project_%' 
        ORDER BY datname
      `);
      await client.end();

      const databases = result.rows.map((row: any) => ({
        name: row.datname,
        projectName: row.datname.replace('project_', '').replace(/_/g, '-'),
        sizeBytes: parseInt(row.size_bytes, 10),
        sizeFormatted: formatBytes(parseInt(row.size_bytes, 10)),
      }));

      res.json({ databases, count: databases.length });
    } catch (error: any) {
      logger.error('Error listing databases:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/shared/databases
   * Create a new project database
   */
  router.post('/databases', async (req: Request, res: Response) => {
    try {
      const { projectName } = req.body;
      if (!projectName) {
        res.status(400).json({ error: 'projectName required' });
        return;
      }

      const dbName = `project_${projectName}`.replace(/-/g, '_');
      const sharedEnv = getSharedEnv();
      if (!sharedEnv) {
        res.status(400).json({ error: 'Shared configuration not found' });
        return;
      }

      const { Client } = await import('pg');
      const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'postgres',
        password: sharedEnv.SHARED_POSTGRES_PASSWORD,
        port: parseInt(sharedEnv.SHARED_PG_PORT || '5432', 10),
      });

      await client.connect();
      await client.query(`CREATE DATABASE ${dbName}`);
      await client.end();

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
   */
  router.delete('/databases/:name', async (req: Request, res: Response) => {
    try {
      const dbName = `project_${req.params.name}`.replace(/-/g, '_');
      const sharedEnv = getSharedEnv();
      if (!sharedEnv) {
        res.status(400).json({ error: 'Shared configuration not found' });
        return;
      }

      const { Client } = await import('pg');
      const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'postgres',
        password: sharedEnv.SHARED_POSTGRES_PASSWORD,
        port: parseInt(sharedEnv.SHARED_PG_PORT || '5432', 10),
      });

      await client.connect();
      // Terminate active connections first
      await client.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${dbName}'
        AND pid <> pg_backend_pid()
      `);
      await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await client.end();

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
