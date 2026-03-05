import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CreateInstanceRequest } from '../types';
import InstanceManager from '../services/InstanceManager';
import DockerManager from '../services/DockerManager';
import { logger } from '../utils/logger';
import { validate } from '../middleware/validate';
import {
  CreateInstanceSchema,
  UpdateResourceLimitsSchema,
  CloneInstanceSchema,
} from '../middleware/schemas';
import { auditLog } from '../middleware/auditLog';
import { requireViewer, requireUser, requireAdmin, requireOrgRole } from '../middleware/authMiddleware';

export function createInstanceRoutes(
  instanceManager: InstanceManager,
  dockerManager: DockerManager,
  prisma: PrismaClient
): Router {
  const router = Router();

  /**
   * Helper: Verify that the instance identified by req.params.name belongs
   * to the org specified in X-Org-Id. Returns 404 if not found.
   * Global admins can always access any instance regardless of org.
   */
  const verifyInstanceOrg = async (req: Request, res: Response): Promise<boolean> => {
    const orgId = (req as any).orgId as string | undefined;
    const name = req.params.name;
    const isAdmin = (req as any).user?.role === 'admin';

    // Admin → always allowed
    if (isAdmin) return true;
    if (!name) return true;

    const record = await prisma.instance.findFirst({ where: { name, orgId } });
    if (!record) {
      res.status(404).json({ error: 'Instance not found in this organisation' });
      return false;
    }
    return true;
  };

  /**
   * GET /api/instances
   * List instances scoped to the active organisation.
   * Global admins without X-Org-Id see ALL instances (including unassigned).
   * Global admins with X-Org-Id see that org's instances + unassigned ones.
   * Org members see only their org's instances.
   */
  router.get('/', requireViewer, requireOrgRole('viewer'), async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).orgId as string | undefined;
      const isAdmin = req.user?.role === 'admin';

      // Get all instances from filesystem
      const allInstances = await instanceManager.listInstances();

      // Admin with no org header → return everything
      if (isAdmin && !orgId) {
        return res.json(allInstances);
      }

      // Get instance names that belong to this org from DB
      const whereClause: any = { orgId };
      const orgInstanceRecords = await prisma.instance.findMany({
        where: whereClause,
        select: { name: true },
      });
      const orgInstanceNames = new Set(orgInstanceRecords.map((r) => r.name));

      // Admin also sees instances with no org assigned yet (legacy / unassigned)
      if (isAdmin) {
        const unassigned = await prisma.instance.findMany({
          where: { orgId: null },
          select: { name: true },
        });
        unassigned.forEach((r) => orgInstanceNames.add(r.name));
      }

      // Filter to org (+ unassigned for admin) instances
      const instances = allInstances.filter((i) => orgInstanceNames.has(i.name));

      return res.json(instances);
    } catch (error: any) {
      logger.error('Error listing instances:', error);
      return res.status(500).json({ error: error.message || 'Failed to list instances' });
    }
  });

  /**
   * POST /api/instances/bulk
   * Execute bulk actions on multiple instances (sequential execution)
   */
  router.post(
    '/bulk',
    requireUser,
    requireOrgRole('member'),
    auditLog('INSTANCE_BULK_ACTION', { includeBody: true }),
    async (req: Request, res: Response) => {
      try {
        const { action, instances: instanceNames } = req.body as {
          action: 'start' | 'stop' | 'restart';
          instances: string[];
        };

        if (!action || !['start', 'stop', 'restart'].includes(action)) {
          return res
            .status(400)
            .json({ error: 'Invalid action. Must be start, stop, or restart.' });
        }

        if (!instanceNames || !Array.isArray(instanceNames) || instanceNames.length === 0) {
          return res.status(400).json({ error: 'No instances provided.' });
        }

        const results: { name: string; success: boolean; message: string }[] = [];

        // Execute in parallel (limited by Promise.all, risky for huge batches but fine for typical usage)
        const promises = instanceNames.map(async (name) => {
          try {
            switch (action) {
              case 'start':
                await instanceManager.startInstance(name);
                break;
              case 'stop':
                await instanceManager.stopInstance(name, true);
                break;
              case 'restart':
                await instanceManager.restartInstance(name);
                break;
            }
            return { name, success: true, message: `${action} successful` };
          } catch (error: any) {
            logger.error(`Bulk ${action} failed for ${name}:`, error);
            return { name, success: false, message: error.message || `${action} failed` };
          }
        });

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);

        const successCount = results.filter((r) => r.success).length;
        const failCount = results.filter((r) => !r.success).length;

        return res.json({
          message: `Bulk ${action}: ${successCount} succeeded, ${failCount} failed`,
          results,
        });
      } catch (error: any) {
        logger.error('Error executing bulk action:', error);
        return res.status(500).json({ error: error.message || 'Failed to execute bulk action' });
      }
    }
  );

  /**
   * GET /api/instances/:name
   * Get a specific instance by name.
   * Admins can open any instance regardless of org assignment.
   * Non-admins: instance must belong to their active org.
   */
  router.get('/:name', requireViewer, requireOrgRole('viewer'), async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const orgId = (req as any).orgId as string | undefined;
      const isAdmin = req.user?.role === 'admin';

      if (!isAdmin) {
        // Non-admin: instance must belong to their org
        const dbInstance = await prisma.instance.findFirst({ where: { name, orgId } });
        if (!dbInstance) {
          return res.status(404).json({ error: 'Instance not found in this organisation' });
        }
      }
      // Admin: no org-filter — can open any instance

      const instances = await instanceManager.listInstances();
      const instance = instances.find((i) => i.name === name);

      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }

      return res.json(instance);
    } catch (error: any) {
      logger.error(`Error getting instance ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message || 'Failed to get instance' });
    }
  });

  /**
   * POST /api/instances
   * Create a new instance (assigned to the active organisation)
   */
  router.post(
    '/',
    requireUser,
    requireOrgRole('member'),
    validate(CreateInstanceSchema),
    auditLog('INSTANCE_CREATE', { includeBody: true }),
    async (req: Request, res: Response): Promise<any> => {
      try {
        let createRequest: CreateInstanceRequest = req.body;
        const user = (req as any).user;

        // Handle Template
        if (createRequest.templateId) {
          const template = await prisma.instanceTemplate.findUnique({
            where: { id: createRequest.templateId },
          });

          if (!template) {
            return res.status(404).json({ error: 'Template not found' });
          }

          // Access check
          if (!template.isPublic && template.createdBy !== user.id && user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied to this template' });
          }

          const templateConfig = JSON.parse(template.config);

          // Merge: Template Config < Request Overrides
          createRequest = {
            ...templateConfig,
            ...createRequest,
          };

          // Ensure basePort is unique/handled by manager if not provided?
          // The manager handles it if not provided? instanceManager.createInstance checks it.
        }

        // Validation is now handled by Zod middleware
        const instance = await instanceManager.createInstance(createRequest);

        // Assign instance to active organisation
        const orgId = (req as any).orgId as string | undefined;
        if (orgId) {
          try {
            await prisma.instance.updateMany({
              where: { name: instance.name },
              data: { orgId },
            });
          } catch (orgErr) {
            logger.warn(`Failed to set orgId for instance ${instance.name}:`, orgErr);
          }
        }

        // Apply Template Overrides (Post-Processing)
        // Only apply if there are actual services or env overrides
        const hasServiceOverrides = (createRequest as any).services?.length > 0;
        const hasEnvOverrides =
          (createRequest as any).env && Object.keys((createRequest as any).env).length > 0;
        if (hasServiceOverrides || hasEnvOverrides) {
          await instanceManager.applyTemplateConfig(instance.name, createRequest);
        }

        res.status(201).json(instance);
      } catch (error: any) {
        logger.error('Error creating instance:', error);
        res.status(500).json({ error: error.message || 'Failed to create instance' });
      }
    }
  );

  /**
   * DELETE /api/instances/:name
   * Delete an instance
   */
  router.delete(
    '/:name',
    requireUser,
    requireOrgRole('admin'),
    auditLog('INSTANCE_DELETE'),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        if (!(await verifyInstanceOrg(req, res))) return;
        const { removeVolumes } = req.query;

        await instanceManager.deleteInstance(name, removeVolumes === 'true');
        res.json({ message: `Instance ${name} deleted successfully` });
      } catch (error: any) {
        logger.error(`Error deleting instance ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to delete instance' });
      }
    }
  );

  /**
   * POST /api/instances/:name/start
   * Start an instance
   */
  router.post(
    '/:name/start',
    requireUser,
    requireOrgRole('member'),
    auditLog('INSTANCE_START'),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        if (!(await verifyInstanceOrg(req, res))) return;
        await instanceManager.startInstance(name);
        res.json({ message: `Instance ${name} started successfully` });
      } catch (error: any) {
        logger.error(`Error starting instance ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to start instance' });
      }
    }
  );

  /**
   * POST /api/instances/:name/stop
   * Stop an instance
   */
  router.post(
    '/:name/stop',
    requireUser,
    requireOrgRole('member'),
    auditLog('INSTANCE_STOP'),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        if (!(await verifyInstanceOrg(req, res))) return;
        const { keepVolumes } = req.query;

        await instanceManager.stopInstance(name, keepVolumes !== 'false');
        res.json({ message: `Instance ${name} stopped successfully` });
      } catch (error: any) {
        logger.error(`Error stopping instance ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to stop instance' });
      }
    }
  );

  /**
   * POST /api/instances/:name/restart
   * Restart an instance
   */
  router.post(
    '/:name/restart',
    requireUser,
    requireOrgRole('member'),
    auditLog('INSTANCE_RESTART'),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        if (!(await verifyInstanceOrg(req, res))) return;
        await instanceManager.restartInstance(name);
        res.json({ message: `Instance ${name} restarted successfully` });
      } catch (error: any) {
        logger.error(`Error restarting instance ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to restart instance' });
      }
    }
  );

  /**
   * POST /api/instances/:name/services/:service/restart
   * Restart a specific service
   */
  router.post(
    '/:name/services/:service/restart',
    requireUser,
    requireOrgRole('member'),
    auditLog('INSTANCE_SERVICE_RESTART', {
      getResource: (req) => `${req.params.name}:${req.params.service}`,
    }),
    async (req: Request, res: Response) => {
      try {
        const { name, service } = req.params;
        await dockerManager.restartService(name, service);
        res.json({ message: `Service ${service} in ${name} restarted successfully` });
      } catch (error: any) {
        logger.error(
          `Error restarting service ${req.params.service} in ${req.params.name}:`,
          error
        );
        res.status(500).json({ error: error.message || 'Failed to restart service' });
      }
    }
  );

  /**
   * POST /api/instances/:name/recreate
   * Recreate an instance (down + up) to apply config changes
   */
  router.post(
    '/:name/recreate',
    requireUser,
    requireOrgRole('member'),
    auditLog('INSTANCE_RECREATE'),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        if (!(await verifyInstanceOrg(req, res))) return;
        await instanceManager.recreateInstance(name);
        res.json({ message: `Instance ${name} recreated successfully` });
      } catch (error: any) {
        logger.error(`Error recreating instance ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to recreate instance' });
      }
    }
  );

  /**
   * PUT /api/instances/:name/credentials
   * Update instance credentials
   */
  router.put(
    '/:name/credentials',
    requireUser,
    requireOrgRole('admin'),
    auditLog('INSTANCE_UPDATE_CREDENTIALS', { includeBody: true }),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        const { regenerateKeys } = req.body;

        const credentials = await instanceManager.updateCredentials(name, regenerateKeys);
        res.json(credentials);
      } catch (error: any) {
        logger.error(`Error updating credentials for ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to update credentials' });
      }
    }
  );

  /**
   * GET /api/instances/:name/services
   * Get services status for an instance
   */
  router.get('/:name/services', requireViewer, requireOrgRole('viewer'), async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const services = await dockerManager.getServiceStatus(name);
      res.json(services);
    } catch (error) {
      logger.error(`Error getting services for ${req.params.name}:`, error);
      res.status(500).json({ error: 'Failed to get services' });
    }
  });

  /**
   * PUT /api/instances/:name/smtp
   * Update instance SMTP settings (override global)
   */
  router.put(
    '/:name/smtp',
    requireUser,
    requireOrgRole('admin'),
    auditLog('INSTANCE_UPDATE_SMTP', { includeBody: true }),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_sender_name, smtp_admin_email } =
          req.body;

        // Construct env updates
        const configUpdates: Record<string, string> = {};

        if (smtp_host) configUpdates.SMTP_HOST = smtp_host;
        if (smtp_port) configUpdates.SMTP_PORT = String(smtp_port);
        if (smtp_user) configUpdates.SMTP_USER = smtp_user;
        if (smtp_pass && smtp_pass !== '********') configUpdates.SMTP_PASS = smtp_pass;
        if (smtp_sender_name) configUpdates.SMTP_SENDER_NAME = smtp_sender_name;
        if (smtp_admin_email) configUpdates.SMTP_ADMIN_EMAIL = smtp_admin_email;

        await instanceManager.updateInstanceConfig(name, configUpdates);

        res.json({ message: 'Instance SMTP settings updated' });
      } catch (error: any) {
        logger.error(`Error updating SMTP settings for ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to update settings' });
      }
    }
  );

  /**
   * GET /api/instances/:name/env
   * Get instance environment variables
   */
  router.get('/:name/env', requireViewer, requireOrgRole('viewer'), async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const { keys } = req.query; // Optional: comma-separated list of keys to fetch

      // We need to expose a method in InstanceManager to get raw env
      // But we can use parseEnvFile through a new method or expose it
      // For now, let's assume we implement `getInstanceConfig` in InstanceManager
      const config = await instanceManager.getInstanceEnv(name);

      if (!config) {
        return res.status(404).json({ error: 'Instance config not found' });
      }

      // Filter keys if requested
      if (keys) {
        const requestedKeys = (keys as string).split(',');
        const filteredConfig: Record<string, string> = {};
        requestedKeys.forEach((key) => {
          if (config[key] !== undefined) {
            filteredConfig[key] = config[key];
          }
        });
        return res.json(filteredConfig);
      }

      // Security: Filter out highly sensitive keys if needed?
      // Admin should see everything usually.
      return res.json(config);
    } catch (error: any) {
      logger.error(`Error getting env for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message || 'Failed to get env' });
    }
  });

  /**
   * PUT /api/instances/:name/env
   * Update instance environment variables directly
   */
  router.put(
    '/:name/env',
    requireUser,
    requireOrgRole('admin'),
    auditLog('INSTANCE_UPDATE_ENV', { includeBody: true }),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        const configUpdates = req.body; // Expects Record<string, string>

        await instanceManager.updateInstanceConfig(name, configUpdates);

        res.json({ message: 'Instance configuration updated' });
      } catch (error: any) {
        logger.error(`Error updating env for ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to update env' });
      }
    }
  );

  /**
   * PUT /api/instances/:name/resources
   * Update instance resource limits
   */
  router.put(
    '/:name/resources',
    requireUser,
    requireOrgRole('admin'),
    validate(UpdateResourceLimitsSchema),
    auditLog('INSTANCE_UPDATE_RESOURCES', { includeBody: true }),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        const { resourceLimits } = req.body;

        const result = await instanceManager.updateInstanceResources(name, resourceLimits);

        res.json({
          message: 'Resource limits updated. Restart the instance to apply changes.',
          ...result,
        });
      } catch (error: any) {
        logger.error(`Error updating resources for ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to update resources' });
      }
    }
  );

  /**
   * POST /api/instances/:name/clone
   * Clone an existing instance with a new name
   */
  router.post(
    '/:name/clone',
    requireUser,
    requireOrgRole('member'),
    validate(CloneInstanceSchema),
    auditLog('INSTANCE_CLONE', { includeBody: true }),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        const { newName, copyEnv } = req.body;

        logger.info(`Cloning instance ${name} to ${newName}`);
        const clonedInstance = await instanceManager.cloneInstance(name, newName, { copyEnv });

        res.status(201).json({
          message: `Instance ${name} successfully cloned to ${newName}`,
          instance: clonedInstance,
        });
      } catch (error: any) {
        logger.error(`Error cloning instance ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to clone instance' });
      }
    }
  );

  /**
   * GET /api/instances/:name/schema
   * Get database schema for an instance
   */
  router.get('/:name/schema', requireViewer, requireOrgRole('viewer'), async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      logger.info(`Getting schema for instance ${name}`);
      const schema = await instanceManager.getSchema(name);
      res.json({ tables: schema });
    } catch (error: any) {
      logger.error(`Error getting schema for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to get schema' });
    }
  });

  /**
   * POST /api/instances/:name/sql
   * Execute SQL query on an instance
   */
  router.post(
    '/:name/sql',
    requireUser,
    requireOrgRole('admin'),
    auditLog('SQL_EXECUTE', { includeBody: false }),
    async (req: Request, res: Response) => {
      try {
        const { name } = req.params;
        const { query } = req.body;

        if (!query || typeof query !== 'string') {
          res.status(400).json({ error: 'SQL query is required' });
          return;
        }

        logger.info(`Executing SQL for instance ${name}`);
        const result = await instanceManager.executeSQL(name, query);

        if (result.error) {
          res.status(400).json({ error: result.error, rows: [] });
          return;
        }

        res.json(result);
      } catch (error: any) {
        logger.error(`Error executing SQL for ${req.params.name}:`, error);
        res.status(500).json({ error: error.message || 'Failed to execute SQL' });
      }
    }
  );

  /**
   * PATCH /api/instances/:name/assign-org
   * Admin-only: assign (or unassign) an existing instance to/from an organisation.
   * Body: { orgId: string | null }
   */
  router.patch(
    '/:name/assign-org',
    requireAdmin,
    auditLog('INSTANCE_ASSIGN_ORG', { includeBody: true }),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const { name } = req.params;
        const { orgId } = req.body as { orgId: string | null };

        // Validate org exists (if setting one)
        if (orgId) {
          const org = await prisma.organisation.findUnique({ where: { id: orgId } });
          if (!org) return res.status(404).json({ error: 'Organisation not found' });
        }

        const updated = await prisma.instance.updateMany({
          where: { name },
          data: { orgId: orgId ?? null },
        });

        if (updated.count === 0) {
          return res.status(404).json({ error: 'Instance not found in database' });
        }

        return res.json({ success: true, name, orgId: orgId ?? null });
      } catch (error: any) {
        logger.error(`Error assigning org for instance ${req.params.name}:`, error);
        return res.status(500).json({ error: error.message || 'Failed to assign org' });
      }
    }
  );

  return router;
}
