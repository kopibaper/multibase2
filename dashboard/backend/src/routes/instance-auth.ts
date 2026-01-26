import { Router, Request, Response } from 'express';
import AuthService from '../services/AuthService';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function createInstanceAuthRoutes() {
  const router = Router();

  /**
   * GET /api/auth/verify-instance-access
   * Verifiziert ob der User Zugriff auf eine Instanz hat
   * Wird von Nginx auth_request aufgerufen
   */
  router.get('/verify-instance-access', async (req: Request, res: Response): Promise<any> => {
    try {
      // 1. Token aus Cookie oder Authorization Header extrahieren
      const token = req.cookies?.auth_token || 
                    req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        logger.debug('Instance access denied: No token provided');
        return res.status(401).json({ error: 'Unauthorized - No token' });
      }

      // 2. Session validieren
      const session = await AuthService.validateSession(token);
      
      if (!session) {
        logger.debug('Instance access denied: Invalid session');
        return res.status(401).json({ error: 'Unauthorized - Invalid session' });
      }

      // 3. Prüfe ob User aktiv ist
      if (!session.user.isActive) {
        logger.debug(`Instance access denied: User ${session.user.username} is not active`);
        return res.status(403).json({ error: 'Forbidden - User not active' });
      }

      // 4. Optional: Instanz-spezifische Zugriffskontrolle
      const instanceName = req.headers['x-instance-name'] as string;
      
      if (instanceName) {
        // Prüfe ob Instanz existiert
        const instance = await prisma.instance.findUnique({
          where: { id: instanceName }
        });

        if (!instance) {
          logger.debug(`Instance access denied: Instance ${instanceName} not found`);
          return res.status(404).json({ error: 'Instance not found' });
        }

        // Optional: Role-based access control
        // Viewer-Rolle könnte z.B. nur lesenden Zugriff haben
        if (session.user.role === 'viewer') {
          logger.debug(`Instance access granted (read-only): ${session.user.username} → ${instanceName}`);
        } else {
          logger.debug(`Instance access granted: ${session.user.username} → ${instanceName}`);
        }
      }

      // 5. Erfolg - Nginx wird Request durchleiten
      return res.status(200).json({ 
        allowed: true, 
        user: session.user.username,
        role: session.user.role
      });
      
    } catch (error) {
      logger.error('Error verifying instance access:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/auth/instance-login-url
   * Generiert eine Login-URL mit Redirect zurück zur Instanz
   */
  router.get('/instance-login-url', async (req: Request, res: Response): Promise<any> => {
    try {
      const redirectUrl = req.query.redirect as string;
      
      if (!redirectUrl) {
        return res.status(400).json({ error: 'redirect parameter required' });
      }

      const loginUrl = `https://multibase.lafftale.online/login?redirect=${encodeURIComponent(redirectUrl)}`;
      
      return res.json({ loginUrl });
    } catch (error) {
      logger.error('Error generating login URL:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
