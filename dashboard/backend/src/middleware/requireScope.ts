import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Scope } from '../constants/scopes';

/**
 * Scope enforcement middleware for API key authenticated requests.
 *
 * Logic:
 * - If no req.apiKey (session-authenticated): skip scope check, role-based auth handles it
 * - If req.apiKey.scopes includes '*': full wildcard access, allowed
 * - If req.apiKey.scopes includes the required scope: allowed
 * - Otherwise: 403 with the required scope name
 *
 * Usage: router.get('/', requireViewer, requireScope(SCOPES.INSTANCES.READ), handler)
 */
export function requireScope(scope: Scope): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = (req as any).apiKey as { id: number; scopes: string[] } | undefined;

    // Not an API key request — session auth is in charge, skip scope check
    if (!apiKey) {
      next();
      return;
    }

    const scopes: string[] = Array.isArray(apiKey.scopes) ? apiKey.scopes : [];

    if (scopes.includes('*') || scopes.includes(scope)) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Insufficient API key scope',
      required: scope,
      provided: scopes,
    });
  };
}
