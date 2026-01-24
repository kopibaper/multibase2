import { Request, Response, NextFunction } from 'express';
import AuthService from '../services/AuthService';
import { logger } from '../utils/logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        role: string;
        isActive: boolean;
        avatar?: string | null;
        twoFactorEnabled?: boolean;
      };
      session?: {
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
      };
    }
  }
}

/**
 * Base middleware: Validates session and attaches user to request
 * Does NOT block - just attaches user if valid
 */
export const attachUser = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const session = await AuthService.validateSession(token);
      if (session) {
        req.user = session.user;
        req.session = session.session as any;
      }
    }
  } catch (error) {
    logger.error('Error attaching user:', error);
  }
  next();
};

/**
 * Require authenticated user (any role)
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await AuthService.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = session.user;
    req.session = session.session as any;
    next();
  } catch (error) {
    logger.error('Error in requireAuth middleware:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Require admin role
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await AuthService.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }

    req.user = session.user;
    req.session = session.session as any;
    next();
  } catch (error) {
    logger.error('Error in requireAdmin middleware:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Require user or admin role (not viewer)
 */
export const requireUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const session = await AuthService.validateSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    if (session.user.role === 'viewer') {
      return res.status(403).json({ error: 'Forbidden - Write access required' });
    }

    req.user = session.user;
    req.session = session.session as any;
    next();
  } catch (error) {
    logger.error('Error in requireUser middleware:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Require viewer, user, or admin role (any logged in user)
 * Alias for requireAuth but semantically clearer for read-only routes
 */
export const requireViewer = requireAuth;
