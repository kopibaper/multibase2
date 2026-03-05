import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import AuthService from '../services/AuthService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

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

// Org role hierarchy (higher index = more permissions)
const ORG_ROLE_HIERARCHY = ['viewer', 'member', 'admin', 'owner'] as const;
type OrgRole = (typeof ORG_ROLE_HIERARCHY)[number];

/**
 * Require that the user is a member of the organisation specified in the X-Org-Id header
 * with at least the given minimum role.
 *
 * Attaches req.orgId and req.orgRole to the request.
 *
 * Global admins with NO X-Org-Id header: skip org check entirely (orgId stays undefined).
 * Global admins WITH X-Org-Id header: bypass membership check, get orgRole = 'owner'.
 * Regular users: must provide X-Org-Id and be a member with sufficient role.
 *
 * @param minRole – minimum org role required (default: 'viewer')
 */
export const requireOrgRole = (minRole: OrgRole = 'viewer') => {
  const minIndex = ORG_ROLE_HIERARCHY.indexOf(minRole);

  return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const orgId = req.headers['x-org-id'] as string | undefined;

      // Global admin with no org header → let them through without org scoping
      if (req.user.role === 'admin' && !orgId) {
        return next();
      }

      if (!orgId) {
        return res.status(400).json({ error: 'X-Org-Id header is required' });
      }

      // Verify the org exists
      const org = await prisma.organisation.findUnique({ where: { id: orgId } });
      if (!org) {
        return res.status(404).json({ error: 'Organisation not found' });
      }

      // Global admins bypass membership check
      if (req.user.role === 'admin') {
        (req as any).orgId = orgId;
        (req as any).orgRole = 'owner';
        return next();
      }

      // Check membership
      const membership = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId, userId: req.user.id } },
      });

      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this organisation' });
      }

      const memberIndex = ORG_ROLE_HIERARCHY.indexOf(membership.role as OrgRole);
      if (memberIndex < minIndex) {
        return res.status(403).json({ error: `Requires at least '${minRole}' role in this organisation` });
      }

      (req as any).orgId = orgId;
      (req as any).orgRole = membership.role;
      next();
    } catch (error) {
      logger.error('Error in requireOrgRole middleware:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};
