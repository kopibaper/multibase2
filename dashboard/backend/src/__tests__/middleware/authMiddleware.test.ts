import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin, requireUser } from '../../middleware/authMiddleware';

// Mock AuthService
vi.mock('../../services/AuthService', () => ({
  default: {
    validateSession: vi.fn(),
  },
}));

import AuthService from '../../services/AuthService';

const makeReq = (token?: string): Request =>
  ({
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: {},
    params: {},
  }) as unknown as Request;

const makeRes = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

const next = vi.fn() as unknown as NextFunction;

const adminSession = {
  user: { id: 'u1', email: 'admin@test.com', username: 'admin', role: 'admin', isActive: true },
  session: { id: 's1', userId: 'u1', token: 'tok', expiresAt: new Date(Date.now() + 3600000) },
};

const viewerSession = {
  user: { id: 'u2', email: 'viewer@test.com', username: 'viewer', role: 'viewer', isActive: true },
  session: { id: 's2', userId: 'u2', token: 'tok', expiresAt: new Date(Date.now() + 3600000) },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAuth', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = makeReq();
    const res = makeRes();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid/expired token', async () => {
    vi.mocked(AuthService.validateSession).mockResolvedValueOnce(null);
    const req = makeReq('invalidtoken');
    const res = makeRes();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches user for valid token', async () => {
    vi.mocked(AuthService.validateSession).mockResolvedValueOnce(adminSession as any);
    const req = makeReq('validtoken');
    const res = makeRes();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.role).toBe('admin');
  });
});

describe('requireAdmin', () => {
  it('returns 403 when user is not admin', async () => {
    vi.mocked(AuthService.validateSession).mockResolvedValueOnce(viewerSession as any);
    const req = makeReq('viewertoken');
    const res = makeRes();
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for admin user', async () => {
    vi.mocked(AuthService.validateSession).mockResolvedValueOnce(adminSession as any);
    const req = makeReq('admintoken');
    const res = makeRes();
    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 when no token provided', async () => {
    const req = makeReq();
    const res = makeRes();
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireUser', () => {
  it('returns 403 for viewer role (write access denied)', async () => {
    vi.mocked(AuthService.validateSession).mockResolvedValueOnce(viewerSession as any);
    const req = makeReq('viewertoken');
    const res = makeRes();
    await requireUser(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for user/admin role', async () => {
    vi.mocked(AuthService.validateSession).mockResolvedValueOnce(adminSession as any);
    const req = makeReq('admintoken');
    const res = makeRes();
    await requireUser(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
