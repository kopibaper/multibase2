import { Router } from 'express';
import { CustomDomainService } from '../services/CustomDomainService';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function createDomainRoutes(domainService: CustomDomainService) {
  const router = Router({ mergeParams: true });

  // List custom domains for an instance
  router.get('/', requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      const domains = await domainService.listDomains(name);
      return res.json({ domains });
    } catch (error: any) {
      logger.error(`Error listing domains for ${req.params.name}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Add a new custom domain
  router.post('/', requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      const { domain } = req.body;

      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ error: 'domain is required' });
      }
      if (!DOMAIN_RE.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain name' });
      }

      const record = await domainService.addDomain(name, domain.toLowerCase());
      return res.status(201).json(record);
    } catch (error: any) {
      logger.error(`Error adding domain for ${req.params.name}:`, error);
      return res.status(400).json({ error: error.message });
    }
  });

  // Check DNS for a custom domain
  router.post('/:domain/check-dns', requireAuth, async (req, res) => {
    try {
      const { name, domain } = req.params;
      if (!DOMAIN_RE.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain name' });
      }

      const result = await domainService.checkDns(name, domain);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error checking DNS for ${req.params.domain}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Attempt automated SSL via certbot (requires certbot installed on server)
  router.post('/:domain/activate-ssl', requireAuth, async (req, res) => {
    try {
      const { name, domain } = req.params;
      const { adminEmail } = req.body;

      if (!DOMAIN_RE.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain name' });
      }
      if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
        return res.status(400).json({ error: 'Valid adminEmail is required' });
      }

      const result = await domainService.activateSsl(name, domain, adminEmail);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error activating SSL for ${req.params.domain}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Manual activation after operator has run certbot themselves
  router.post('/:domain/manual-activate', requireAuth, async (req, res) => {
    try {
      const { name, domain } = req.params;
      const { certDir } = req.body;

      if (!DOMAIN_RE.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain name' });
      }
      if (!certDir || typeof certDir !== 'string') {
        // Default to standard Let's Encrypt path
        const defaultCertDir = `/etc/letsencrypt/live/${domain}`;
        const result = await domainService.manualActivate(name, domain, defaultCertDir);
        return res.json(result);
      }

      // Prevent path traversal in certDir
      const normalized = certDir.replace(/\.\./g, '');
      const result = await domainService.manualActivate(name, domain, normalized);
      return res.json(result);
    } catch (error: any) {
      logger.error(`Error manually activating domain ${req.params.domain}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Remove a custom domain
  router.delete('/:domain', requireAuth, async (req, res) => {
    try {
      const { name, domain } = req.params;
      if (!DOMAIN_RE.test(domain)) {
        return res.status(400).json({ error: 'Invalid domain name' });
      }

      await domainService.removeDomain(name, domain);
      return res.json({ success: true });
    } catch (error: any) {
      logger.error(`Error removing domain ${req.params.domain}:`, error);
      return res.status(500).json({ error: error.message });
    }
  });

  return router;
}
