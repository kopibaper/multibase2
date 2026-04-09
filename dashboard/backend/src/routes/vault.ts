import { Router } from 'express';
import { InstanceManager } from '../services/InstanceManager';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { requireScope } from '../middleware/requireScope';
import { SCOPES } from '../constants/scopes';
import { auditLog } from '../middleware/auditLog';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET_NAME_RE = /^[\w\-\.]+$/;

/**
 * Safely embed an arbitrary string as a PostgreSQL dollar-quoted literal.
 * Using a random tag makes it injection-proof regardless of the value's content.
 */
function pgStr(s: string): string {
  const tag = `qv${Math.floor(Math.random() * 1e9).toString(36)}`;
  return `$${tag}$${s}$${tag}$`;
}

export function createVaultRoutes(instanceManager: InstanceManager) {
  const router = Router({ mergeParams: true });

  /** GET / — list secrets (names + metadata, no values) */
  router.get('/', requireAuth, requireScope(SCOPES.VAULT.READ), async (req, res) => {
    try {
      const { name } = req.params;
      const sql = `SELECT id, name, description, created_at, updated_at FROM vault.secrets ORDER BY created_at DESC`;
      const result = await instanceManager.executeSQL(name, sql);
      if (result.error) {
        // Vault extension not enabled in this instance
        return res.json({ secrets: [], available: false, error: result.error });
      }
      return res.json({ secrets: result.rows, available: true });
    } catch (err: any) {
      logger.error(`vault.list error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  /** POST / — create a new secret */
  router.post('/', requireAuth, requireScope(SCOPES.VAULT.WRITE), auditLog('VAULT_SECRET_CREATE', { includeBody: false, getResource: (req) => `${req.params.name}/${req.body?.secretName || 'unknown'}` }), async (req, res) => {
    try {
      const { name } = req.params;
      const { secretName, value, description = '' } = req.body;
      if (!secretName || typeof secretName !== 'string' || !SECRET_NAME_RE.test(secretName)) {
        return res.status(400).json({
          error: 'Invalid secret name. Use letters, digits, underscores, hyphens, or dots.',
        });
      }
      if (typeof value !== 'string') {
        return res.status(400).json({ error: 'value must be a string' });
      }
      // vault.create_secret(secret, name, description)
      const sql = `SELECT vault.create_secret(${pgStr(value)}, ${pgStr(secretName)}, ${pgStr(String(description))})`;
      const result = await instanceManager.executeSQL(name, sql);
      if (result.error) return res.status(500).json({ error: result.error });
      return res.status(201).json({ success: true });
    } catch (err: any) {
      logger.error(`vault.create error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  /** GET /:id/reveal — return the decrypted secret value */
  router.get('/:id/reveal', requireAuth, requireScope(SCOPES.VAULT.READ), auditLog('VAULT_SECRET_REVEAL', { getResource: (req) => `${req.params.name}/${req.params.id}` }), async (req, res) => {
    try {
      const { name, id } = req.params;
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid secret id' });
      const sql = `SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = '${id}'`;
      const result = await instanceManager.executeSQL(name, sql);
      if (result.error) return res.status(500).json({ error: result.error });
      const value = result.rows[0]?.decrypted_secret ?? null;
      return res.json({ value });
    } catch (err: any) {
      logger.error(`vault.reveal error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  /** PATCH /:id — update a secret's value */
  router.patch('/:id', requireAuth, requireScope(SCOPES.VAULT.WRITE), auditLog('VAULT_SECRET_UPDATE', { includeBody: false, getResource: (req) => `${req.params.name}/${req.params.id}` }), async (req, res) => {
    try {
      const { name, id } = req.params;
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid secret id' });
      const { value } = req.body;
      if (typeof value !== 'string') {
        return res.status(400).json({ error: 'value must be a string' });
      }
      const sql = `SELECT vault.update_secret('${id}', ${pgStr(value)})`;
      const result = await instanceManager.executeSQL(name, sql);
      if (result.error) return res.status(500).json({ error: result.error });
      return res.json({ success: true });
    } catch (err: any) {
      logger.error(`vault.update error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  /** DELETE /:id — delete a secret */
  router.delete('/:id', requireAuth, requireScope(SCOPES.VAULT.WRITE), auditLog('VAULT_SECRET_DELETE', { getResource: (req) => `${req.params.name}/${req.params.id}` }), async (req, res) => {
    try {
      const { name, id } = req.params;
      if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid secret id' });
      const sql = `DELETE FROM vault.secrets WHERE id = '${id}'`;
      const result = await instanceManager.executeSQL(name, sql);
      if (result.error) return res.status(500).json({ error: result.error });
      return res.json({ success: true });
    } catch (err: any) {
      logger.error(`vault.delete error:`, err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
