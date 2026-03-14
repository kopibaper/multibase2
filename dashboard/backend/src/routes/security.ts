import path from 'path';
import { Router } from 'express';
import { InstanceManager } from '../services/InstanceManager';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  generateAndWriteTenantConfig,
  reloadNginxGateway,
} from '../services/NginxGatewayGenerator';

/** IPv4 or CIDR notation, e.g. 1.2.3.4 or 10.0.0.0/24 */
const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

export function createSecurityRoutes(instanceManager: InstanceManager, projectsPath: string) {
  const router = Router({ mergeParams: true });

  /** GET / — read current security settings from the instance .env */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      const env = await instanceManager.getInstanceEnv(name);
      const ipWhitelist = env['SECURITY_IP_WHITELIST'] || '';
      const rateLimitRpmRaw = parseInt(env['SECURITY_RATE_LIMIT_RPM'] || '0', 10);
      const rateLimitRpm = !isNaN(rateLimitRpmRaw) && rateLimitRpmRaw > 0 ? rateLimitRpmRaw : 300;
      return res.json({
        sslOnly: env['SECURITY_SSL_ONLY'] === 'true',
        ipWhitelistEnabled: !!ipWhitelist,
        ipWhitelist,
        rateLimitEnabled: !isNaN(rateLimitRpmRaw) && rateLimitRpmRaw > 0,
        rateLimitRpm,
      });
    } catch (err: any) {
      logger.error(`security.get error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  /** PATCH / — write SECURITY_* env vars and regenerate nginx config */
  router.patch('/', requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      const { sslOnly, ipWhitelistEnabled, ipWhitelist, rateLimitEnabled, rateLimitRpm } = req.body;

      // Validate IP/CIDR values before writing
      if (ipWhitelistEnabled && ipWhitelist) {
        const ips: string[] = String(ipWhitelist)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        for (const ip of ips) {
          if (!CIDR_RE.test(ip)) {
            return res.status(400).json({ error: `Invalid IP or CIDR notation: "${ip}"` });
          }
        }
      }

      const updates: Record<string, string> = {};
      if (sslOnly !== undefined) {
        updates['SECURITY_SSL_ONLY'] = sslOnly ? 'true' : 'false';
      }
      if (ipWhitelistEnabled !== undefined) {
        updates['SECURITY_IP_WHITELIST'] = ipWhitelistEnabled
          ? String(ipWhitelist || '').trim()
          : '';
      }
      if (rateLimitEnabled !== undefined) {
        const rpm = parseInt(rateLimitRpm, 10);
        updates['SECURITY_RATE_LIMIT_RPM'] = rateLimitEnabled && !isNaN(rpm) ? String(rpm) : '0';
      }

      await instanceManager.updateInstanceConfig(name, updates);

      // Regenerate tenant nginx config with updated security directives
      const sharedDir = path.resolve(projectsPath, '..', 'shared');
      await generateAndWriteTenantConfig(name, projectsPath, sharedDir);
      await reloadNginxGateway();

      return res.json({ success: true, message: 'Security settings saved and nginx reloaded.' });
    } catch (err: any) {
      logger.error(`security.update error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
