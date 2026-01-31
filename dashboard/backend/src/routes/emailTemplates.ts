import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import InstanceManager from '../services/InstanceManager';
import { logger } from '../utils/logger';
import { requireUser, requireViewer } from '../middleware/authMiddleware';
import { auditLog } from '../middleware/auditLog';

// Email template types
const TEMPLATE_TYPES = [
  'confirmation',
  'recovery',
  'invite',
  'magic_link',
  'email_change',
] as const;
type TemplateType = (typeof TEMPLATE_TYPES)[number];

// GoTrue environment variable mapping
const TEMPLATE_ENV_MAP: Record<TemplateType, string> = {
  confirmation: 'GOTRUE_MAILER_TEMPLATES_CONFIRMATION',
  recovery: 'GOTRUE_MAILER_TEMPLATES_RECOVERY',
  invite: 'GOTRUE_MAILER_TEMPLATES_INVITE',
  magic_link: 'GOTRUE_MAILER_TEMPLATES_MAGIC_LINK',
  email_change: 'GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE',
};

// Default templates with modern design
const DEFAULT_TEMPLATES: Record<TemplateType, string> = {
  confirmation: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your email</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 40px; }
    h1 { color: #f8fafc; font-size: 24px; margin: 0 0 16px; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px; }
    .button { display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .code { background: #334155; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 24px; color: #22d3ee; text-align: center; margin: 24px 0; letter-spacing: 4px; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Confirm your email</h1>
    <p>Thanks for signing up! Please confirm your email address by clicking the button below.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="button">Confirm Email</a>
    </div>
    <p>Or use this code:</p>
    <div class="code">{{ .Token }}</div>
    <div class="footer">
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>This link expires in 24 hours.</p>
    </div>
  </div>
</body>
</html>`,

  recovery: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 40px; }
    h1 { color: #f8fafc; font-size: 24px; margin: 0 0 16px; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px; }
    .button { display: inline-block; background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .code { background: #334155; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 24px; color: #fbbf24; text-align: center; margin: 24px 0; letter-spacing: 4px; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Reset your password</h1>
    <p>We received a request to reset your password. Click the button below to choose a new password.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="button">Reset Password</a>
    </div>
    <p>Or use this code:</p>
    <div class="code">{{ .Token }}</div>
    <div class="footer">
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>This link expires in 1 hour.</p>
    </div>
  </div>
</body>
</html>`,

  invite: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You've been invited</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 40px; }
    h1 { color: #f8fafc; font-size: 24px; margin: 0 0 16px; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px; }
    .button { display: inline-block; background: linear-gradient(135deg, #10b981, #14b8a6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You've been invited! 🎉</h1>
    <p>You have been invited to join. Click the button below to accept your invitation and create your account.</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="button">Accept Invitation</a>
    </div>
    <div class="footer">
      <p>This invitation expires in 24 hours.</p>
    </div>
  </div>
</body>
</html>`,

  magic_link: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your login link</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 40px; }
    h1 { color: #f8fafc; font-size: 24px; margin: 0 0 16px; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px; }
    .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #d946ef); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .code { background: #334155; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 24px; color: #c084fc; text-align: center; margin: 24px 0; letter-spacing: 4px; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Your magic login link ✨</h1>
    <p>Click the button below to log in to your account. No password needed!</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="button">Log In</a>
    </div>
    <p>Or use this code:</p>
    <div class="code">{{ .Token }}</div>
    <div class="footer">
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>This link expires in 10 minutes.</p>
    </div>
  </div>
</body>
</html>`,

  email_change: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm email change</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; margin: 0; padding: 40px 20px; }
    .container { max-width: 480px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 40px; }
    h1 { color: #f8fafc; font-size: 24px; margin: 0 0 16px; }
    p { color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px; }
    .button { display: inline-block; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .highlight { background: #334155; padding: 12px 16px; border-radius: 8px; color: #22d3ee; font-family: monospace; margin: 16px 0; }
    .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Confirm your new email</h1>
    <p>Please confirm that you want to change your email address to:</p>
    <div class="highlight">{{ .NewEmail }}</div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="button">Confirm Change</a>
    </div>
    <div class="footer">
      <p>If you didn't request this change, please contact support immediately.</p>
    </div>
  </div>
</body>
</html>`,
};

export function createEmailTemplateRoutes(
  instanceManager: InstanceManager,
  prisma: PrismaClient
): Router {
  const router = Router();
  const PROJECTS_PATH = process.env.PROJECTS_PATH || path.join(__dirname, '../../../projects');

  /**
   * GET /api/instances/:name/email-templates
   * Get all email templates for an instance
   */
  router.get('/:name/email-templates', requireViewer, async (req: Request, res: Response) => {
    try {
      const { name } = req.params;
      const templatesDir = path.join(PROJECTS_PATH, name, 'volumes', 'email-templates');

      const templates: Record<TemplateType, { html: string; isDefault: boolean }> = {} as any;

      for (const type of TEMPLATE_TYPES) {
        const templatePath = path.join(templatesDir, `${type}.html`);
        let html = DEFAULT_TEMPLATES[type];
        let isDefault = true;

        if (fs.existsSync(templatePath)) {
          html = fs.readFileSync(templatePath, 'utf-8');
          isDefault = false;
        }

        templates[type] = { html, isDefault };
      }

      res.json({ templates });
    } catch (error: any) {
      logger.error(`Error getting email templates for ${req.params.name}:`, error);
      res.status(500).json({ error: error.message || 'Failed to get email templates' });
    }
  });

  /**
   * PUT /api/instances/:name/email-templates/:type
   * Save an email template
   */
  router.put(
    '/:name/email-templates/:type',
    requireUser,
    auditLog('INSTANCE_UPDATE_EMAIL_TEMPLATE'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const { name, type } = req.params;
        const { html } = req.body;

        // Validate template type
        if (!TEMPLATE_TYPES.includes(type as TemplateType)) {
          return res.status(400).json({ error: `Invalid template type: ${type}` });
        }

        if (!html || typeof html !== 'string') {
          return res.status(400).json({ error: 'HTML content is required' });
        }

        const templatesDir = path.join(PROJECTS_PATH, name, 'volumes', 'email-templates');

        // Create directory if it doesn't exist
        if (!fs.existsSync(templatesDir)) {
          fs.mkdirSync(templatesDir, { recursive: true });
        }

        // Write template file
        const templatePath = path.join(templatesDir, `${type}.html`);
        fs.writeFileSync(templatePath, html, 'utf-8');

        // Update instance .env with template URL
        // The URL will be served by our static file server
        const templateUrl = `/api/instances/${name}/email-templates/${type}/render`;
        const envKey = TEMPLATE_ENV_MAP[type as TemplateType];

        await instanceManager.updateInstanceConfig(name, {
          [envKey]: templateUrl,
        });

        logger.info(`Email template ${type} saved for instance ${name}`);

        res.json({
          message: `Template ${type} saved successfully`,
          type,
          isDefault: false,
        });
      } catch (error: any) {
        logger.error(`Error saving email template:`, error);
        res.status(500).json({ error: error.message || 'Failed to save template' });
      }
    }
  );

  /**
   * GET /api/instances/:name/email-templates/:type/render
   * Render template HTML (used by GoTrue to fetch templates)
   */
  router.get(
    '/:name/email-templates/:type/render',
    async (req: Request, res: Response): Promise<any> => {
      try {
        const { name, type } = req.params;

        if (!TEMPLATE_TYPES.includes(type as TemplateType)) {
          return res.status(400).json({ error: `Invalid template type: ${type}` });
        }

        const templatePath = path.join(
          PROJECTS_PATH,
          name,
          'volumes',
          'email-templates',
          `${type}.html`
        );

        let html: string;
        if (fs.existsSync(templatePath)) {
          html = fs.readFileSync(templatePath, 'utf-8');
        } else {
          html = DEFAULT_TEMPLATES[type as TemplateType];
        }

        res.type('text/html').send(html);
      } catch (error: any) {
        logger.error(`Error rendering email template:`, error);
        res.status(500).send('Error rendering template');
      }
    }
  );

  /**
   * POST /api/instances/:name/email-templates/:type/reset
   * Reset template to default
   */
  router.post(
    '/:name/email-templates/:type/reset',
    requireUser,
    auditLog('INSTANCE_RESET_EMAIL_TEMPLATE'),
    async (req: Request, res: Response): Promise<any> => {
      try {
        const { name, type } = req.params;

        if (!TEMPLATE_TYPES.includes(type as TemplateType)) {
          return res.status(400).json({ error: `Invalid template type: ${type}` });
        }

        const templatePath = path.join(
          PROJECTS_PATH,
          name,
          'volumes',
          'email-templates',
          `${type}.html`
        );

        // Delete custom template if exists
        if (fs.existsSync(templatePath)) {
          fs.unlinkSync(templatePath);
        }

        // Remove the env var so GoTrue uses its default
        const envKey = TEMPLATE_ENV_MAP[type as TemplateType];
        await instanceManager.updateInstanceConfig(name, {
          [envKey]: '',
        });

        logger.info(`Email template ${type} reset to default for instance ${name}`);

        res.json({
          message: `Template ${type} reset to default`,
          type,
          isDefault: true,
        });
      } catch (error: any) {
        logger.error(`Error resetting email template:`, error);
        res.status(500).json({ error: error.message || 'Failed to reset template' });
      }
    }
  );

  /**
   * POST /api/instances/:name/email-templates/test
   * Send a test email
   */
  router.post(
    '/:name/email-templates/test',
    requireUser,
    async (req: Request, res: Response): Promise<any> => {
      try {
        const { name } = req.params;
        const { type, email } = req.body;

        if (!type || !TEMPLATE_TYPES.includes(type as TemplateType)) {
          return res.status(400).json({ error: 'Valid template type is required' });
        }

        if (!email || !email.includes('@')) {
          return res.status(400).json({ error: 'Valid email address is required' });
        }

        // Get SMTP config - try instance first, then global
        const instanceEnv = await instanceManager.getInstanceEnv(name);

        // Get global SMTP settings (singleton with id=1)
        const globalSmtp = await prisma.globalSettings.findFirst();

        // Build effective SMTP config (instance overrides global)
        const smtpConfig = {
          host: instanceEnv.GOTRUE_SMTP_HOST || instanceEnv.SMTP_HOST || globalSmtp?.smtp_host,
          port: parseInt(
            instanceEnv.GOTRUE_SMTP_PORT ||
              instanceEnv.SMTP_PORT ||
              String(globalSmtp?.smtp_port || 587)
          ),
          user: instanceEnv.GOTRUE_SMTP_USER || instanceEnv.SMTP_USER || globalSmtp?.smtp_user,
          pass: instanceEnv.GOTRUE_SMTP_PASS || instanceEnv.SMTP_PASS || globalSmtp?.smtp_pass,
          from:
            instanceEnv.GOTRUE_SMTP_ADMIN_EMAIL ||
            instanceEnv.SMTP_ADMIN_EMAIL ||
            globalSmtp?.smtp_admin_email,
          fromName:
            instanceEnv.GOTRUE_SMTP_SENDER_NAME ||
            instanceEnv.SMTP_SENDER_NAME ||
            globalSmtp?.smtp_sender_name ||
            'Multibase',
        };

        if (!smtpConfig.host) {
          return res.status(400).json({
            error:
              'SMTP not configured. Please configure SMTP settings for this instance or globally.',
          });
        }

        // Get template
        const templatePath = path.join(
          PROJECTS_PATH,
          name,
          'volumes',
          'email-templates',
          `${type}.html`
        );

        let html = fs.existsSync(templatePath)
          ? fs.readFileSync(templatePath, 'utf-8')
          : DEFAULT_TEMPLATES[type as TemplateType];

        // Replace variables with sample values
        const sampleValues: Record<string, string> = {
          '{{ .ConfirmationURL }}': 'https://example.com/confirm?token=sample123',
          '{{ .SiteURL }}': 'https://example.com',
          '{{ .RedirectTo }}': 'https://example.com/dashboard',
          '{{ .Email }}': email,
          '{{ .NewEmail }}': 'newemail@example.com',
          '{{ .Token }}': '123456',
          '{{ .TokenHash }}': 'abc123def456',
          '{{ .OTP }}': '987654',
          '{{ .Data.first_name }}': 'John',
          '{{ .Data.last_name }}': 'Doe',
          '{{ .Data.username }}': 'johndoe',
          '{{ .Data.app_name }}': 'My App',
          '{{ .Data.company }}': 'My Company',
          '{{ .Data.logo_url }}': 'https://example.com/logo.png',
          '{{ .ExpiresAt }}': new Date(Date.now() + 3600000).toISOString(),
          '{{ .CreatedAt }}': new Date().toISOString(),
        };

        for (const [key, value] of Object.entries(sampleValues)) {
          html = html.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }

        // Create transporter
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.port === 465,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        } as nodemailer.TransportOptions);

        // Get subject based on type
        const subjects: Record<TemplateType, string> = {
          confirmation: 'Confirm your email (Test)',
          recovery: 'Reset your password (Test)',
          invite: 'You have been invited (Test)',
          magic_link: 'Your login link (Test)',
          email_change: 'Confirm email change (Test)',
        };

        // Send test email
        await transporter.sendMail({
          from: `"${smtpConfig.fromName}" <${smtpConfig.from}>`,
          to: email,
          subject: subjects[type as TemplateType],
          html,
        });

        logger.info(`Test email (${type}) sent to ${email} for instance ${name}`);

        res.json({
          message: `Test email sent to ${email}`,
          type,
          usedGlobalSmtp: !instanceEnv.GOTRUE_SMTP_HOST && !instanceEnv.SMTP_HOST,
        });
      } catch (error: any) {
        logger.error(`Error sending test email:`, error);
        res.status(500).json({ error: error.message || 'Failed to send test email' });
      }
    }
  );

  /**
   * GET /api/instances/:name/email-templates/variables
   * Get available template variables
   */
  router.get('/:name/email-templates/variables', requireViewer, (_req: Request, res: Response) => {
    res.json({
      variables: {
        urls: [
          { name: '{{ .ConfirmationURL }}', description: 'The confirmation/action URL' },
          { name: '{{ .SiteURL }}', description: 'Your application base URL' },
          { name: '{{ .RedirectTo }}', description: 'Redirect URL after action' },
        ],
        user: [
          { name: '{{ .Email }}', description: 'User email address' },
          { name: '{{ .NewEmail }}', description: 'New email (for email change)' },
          { name: '{{ .Data.first_name }}', description: 'User first name' },
          { name: '{{ .Data.last_name }}', description: 'User last name' },
          { name: '{{ .Data.username }}', description: 'Username' },
        ],
        security: [
          { name: '{{ .Token }}', description: '6-digit OTP code' },
          { name: '{{ .TokenHash }}', description: 'Token hash' },
          { name: '{{ .OTP }}', description: 'One-time password' },
        ],
        branding: [
          { name: '{{ .Data.app_name }}', description: 'Application name' },
          { name: '{{ .Data.company }}', description: 'Company name' },
          { name: '{{ .Data.logo_url }}', description: 'Logo URL' },
        ],
        time: [
          { name: '{{ .ExpiresAt }}', description: 'Expiration timestamp' },
          { name: '{{ .CreatedAt }}', description: 'Creation timestamp' },
        ],
      },
    });
  });

  return router;
}
