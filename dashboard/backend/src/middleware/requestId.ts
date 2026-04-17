import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Assigns a unique X-Request-ID header to every request.
 * Reuses the client-supplied header if present (useful for distributed tracing),
 * otherwise generates a new UUID v4.
 *
 * The ID is available as req.requestId and returned in every response header,
 * making it easy to correlate logs with specific requests.
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const id = (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
};
