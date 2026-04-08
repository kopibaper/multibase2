import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import InstanceManager from '../services/InstanceManager';
import { logger } from '../utils/logger';
import { CreateInstanceRequest, SHARED_SERVICES, TENANT_SERVICES, RESOURCE_PRESETS } from '../types';

// Curated list of env vars that templates can configure
const CONFIGURABLE_TEMPLATE_ENV_VARS = [
  // Auth
  'GOTRUE_EXTERNAL_EMAIL_ENABLED', 'GOTRUE_MAILER_AUTOCONFIRM',
  'GOTRUE_SMTP_HOST', 'GOTRUE_SMTP_PORT', 'GOTRUE_SMTP_USER', 'GOTRUE_SMTP_PASS',
  'GOTRUE_SMTP_ADMIN_EMAIL', 'GOTRUE_SMTP_SENDER_NAME',
  'GOTRUE_EXTERNAL_GOOGLE_ENABLED', 'GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID', 'GOTRUE_EXTERNAL_GOOGLE_SECRET',
  'GOTRUE_EXTERNAL_GITHUB_ENABLED', 'GOTRUE_EXTERNAL_GITHUB_CLIENT_ID', 'GOTRUE_EXTERNAL_GITHUB_SECRET',
  'GOTRUE_EXTERNAL_DISCORD_ENABLED', 'GOTRUE_EXTERNAL_DISCORD_CLIENT_ID', 'GOTRUE_EXTERNAL_DISCORD_SECRET',
  'GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED', 'GOTRUE_EXTERNAL_PHONE_ENABLED',
  // API
  'PGRST_DB_SCHEMAS', 'PGRST_MAX_ROWS',
  // Realtime
  'REALTIME_MAX_HEADER_LENGTH',
  // Storage
  'STORAGE_BACKEND', 'REGION', 'GLOBAL_S3_BUCKET', 'STORAGE_S3_ENDPOINT',
  'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'STORAGE_S3_FORCE_PATH_STYLE',
  // Pooler
  'POOLER_POOL_MODE', 'POOLER_MAX_CLIENT_CONN', 'POOLER_DEFAULT_POOL_SIZE',
  // AI
  'OPENAI_API_KEY',
] as const;

/** Normalize legacy template configs to current format */
function normalizeTemplateConfig(raw: any) {
  return {
    deploymentType: raw.deploymentType || 'cloud',
    domain: raw.domain,
    protocol: raw.protocol,
    corsOrigins: raw.corsOrigins,
    env: raw.env || {},
    resourceLimits: raw.resourceLimits,
    extensions: raw.extensions || [],
    initSql: raw.initSql || '',
    environment: raw.environment,
  };
}

// Validation Schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  config: z.any(), // Accepts object path, logic will stringify
  isPublic: z.boolean().optional(),
});

const useTemplateSchema = z.object({
  instanceName: z.string().min(1).max(100),
  overrides: z.any().optional(),
});

export function createTemplateRoutes(instanceManager: InstanceManager) {
  const router = Router();

  /**
   * GET /api/templates
   * List templates (public + user created)
   */
  router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      const templates = await prisma.instanceTemplate.findMany({
        where: {
          OR: [{ isPublic: true }, { createdBy: user.id }],
        },
        include: {
          creator: {
            select: {
              username: true,
              id: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Parse config JSON strings and normalize to current format
      const parsedTemplates = templates.map((t) => ({
        ...t,
        config: normalizeTemplateConfig(JSON.parse(t.config)),
      }));

      return res.json({ templates: parsedTemplates });
    } catch (error) {
      logger.error('Error fetching templates:', error);
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  /**
   * GET /api/templates/system
   * Get shared infrastructure template metadata
   */
  router.get('/system', requireAuth, async (_req: Request, res: Response) => {
    try {
      const extensions = await prisma.extension.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      return res.json({
        sharedServices: [...SHARED_SERVICES],
        tenantServices: [...TENANT_SERVICES],
        availableExtensions: extensions,
        configurableEnvVars: CONFIGURABLE_TEMPLATE_ENV_VARS,
        resourcePresets: RESOURCE_PRESETS,
      });
    } catch (error) {
      logger.error('Error fetching system template:', error);
      return res.status(500).json({ error: 'Failed to fetch system template' });
    }
  });

  /**
   * POST /api/templates
   * Create a new template from provided config
   */
  router.post(
    '/',
    requireAuth,
    auditLog('TEMPLATE_CREATE', { includeBody: true }),
    async (req: Request, res: Response) => {
      try {
        const user = (req as any).user;
        const validation = createTemplateSchema.safeParse(req.body);

        if (!validation.success) {
          return res.status(400).json({ error: validation.error.errors });
        }

        const { name, description, config, isPublic } = validation.data;

        // Ensure config has minimal required fields
        if (!config.deploymentType) {
          return res.status(400).json({ error: 'Config must include deploymentType' });
        }

        const template = await prisma.instanceTemplate.create({
          data: {
            name,
            description,
            config: JSON.stringify(config),
            isPublic: user.role === 'admin' ? isPublic || false : false,
            createdBy: user.id,
          },
        });

        return res.status(201).json({
          ...template,
          config: JSON.parse(template.config),
        });
      } catch (error) {
        logger.error('Error creating template:', error);
        if ((error as any).code === 'P2002') {
          return res.status(409).json({ error: 'Template name already exists' });
        }
        return res.status(500).json({ error: 'Failed to create template' });
      }
    }
  );

  /**
   * GET /api/templates/:id
   * Get details of a specific template
   */
  router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const template = await prisma.instanceTemplate.findUnique({
        where: { id },
        include: {
          creator: {
            select: { username: true },
          },
        },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      if (!template.isPublic && template.createdBy !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json({
        ...template,
        config: normalizeTemplateConfig(JSON.parse(template.config)),
      });
    } catch (error) {
      logger.error(`Error fetching template ${req.params.id}:`, error);
      return res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  /**
   * PUT /api/templates/:id
   * Update a template
   */
  router.put(
    '/:id',
    requireAuth,
    auditLog('TEMPLATE_UPDATE', { includeBody: true }),
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const user = (req as any).user;
        const { name, description, config, isPublic } = req.body;

        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid ID' });
        }

        const existing = await prisma.instanceTemplate.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Template not found' });

        if (existing.createdBy !== user.id && user.role !== 'admin') {
          return res.status(403).json({ error: 'Not authorized' });
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (config) updateData.config = JSON.stringify(config);
        if (isPublic !== undefined && user.role === 'admin') updateData.isPublic = isPublic;

        const updated = await prisma.instanceTemplate.update({
          where: { id },
          data: updateData,
        });

        return res.json({
          ...updated,
          config: JSON.parse(updated.config),
        });
      } catch (error) {
        logger.error('Error updating template:', error);
        return res.status(500).json({ error: 'Failed to update template' });
      }
    }
  );

  /**
   * DELETE /api/templates/:id
   * Delete a template (owner only)
   */
  router.delete(
    '/:id',
    requireAuth,
    auditLog('TEMPLATE_DELETE'),
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const user = (req as any).user;

        if (isNaN(id)) {
          return res.status(400).json({ error: 'Invalid ID' });
        }

        const template = await prisma.instanceTemplate.findUnique({
          where: { id },
        });

        if (!template) {
          return res.status(404).json({ error: 'Template not found' });
        }

        if (template.createdBy !== user.id && user.role !== 'admin') {
          return res.status(403).json({ error: 'Only the creator can delete this template' });
        }

        await prisma.instanceTemplate.delete({
          where: { id },
        });

        return res.json({ message: 'Template deleted successfully' });
      } catch (error) {
        logger.error(`Error deleting template ${req.params.id}:`, error);
        return res.status(500).json({ error: 'Failed to delete template' });
      }
    }
  );

  /**
   * POST /api/templates/:id/use
   * Direct instantiation from template
   */
  router.post('/:id/use', requireAuth, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const id = parseInt(req.params.id);

      const validation = useTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors });
      }
      const { instanceName, overrides } = validation.data;

      const template = await prisma.instanceTemplate.findUnique({ where: { id } });
      if (!template) return res.status(404).json({ error: 'Template not found' });

      if (!template.isPublic && template.createdBy !== user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const rawConfig = { ...JSON.parse(template.config), ...(overrides || {}) };
      const config = normalizeTemplateConfig(rawConfig);

      const createRequest: CreateInstanceRequest = {
        name: instanceName,
        deploymentType: config.deploymentType || 'cloud',
        corsOrigins: config.corsOrigins,
        domain: config.domain,
        protocol: config.protocol,
        env: config.env,
        resourceLimits: config.resourceLimits,
        extensions: config.extensions,
        initSql: config.initSql,
        environment: config.environment,
      };

      const instance = await instanceManager.createInstance(createRequest);

      logger.info(`Instance created from template ${id}: ${instance.name}`);

      return res.status(201).json({
        message: 'Instance created successfully',
        instance,
      });
    } catch (error: any) {
      logger.error('Error using template:', error);
      return res.status(500).json({ error: error.message || 'Failed to create instance' });
    }
  });

  return router;
}
