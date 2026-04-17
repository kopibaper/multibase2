import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { Request, Response, NextFunction } from 'express';
import { auditLog, createAuditLogEntry } from '../../middleware/auditLog';
import prisma from '../../lib/prisma';

const mockNext = vi.fn() as unknown as NextFunction;

const createMockResponse = (statusCode = 200) => {
  const emitter = new EventEmitter();
  const res = Object.assign(emitter, {
    statusCode,
    get: vi.fn(),
  }) as unknown as Response;
  return res;
};

const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    method: 'POST',
    path: '/api/test',
    params: {},
    body: {},
    query: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    get: vi.fn((header: string) => (header === 'user-agent' ? 'test-agent' : undefined)),
    user: { id: 'user-1' },
    headers: {},
    ...overrides,
  }) as unknown as Request;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
});

describe('auditLog middleware', () => {
  it('calls next() immediately', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    auditLog('TEST_ACTION')(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('creates an audit log entry after response finishes', async () => {
    const req = createMockRequest();
    const res = createMockResponse(200);
    auditLog('TEST_ACTION')(req, res, mockNext);
    res.emit('finish');
    // Allow the async handler to run
    await new Promise(r => setTimeout(r, 10));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'TEST_ACTION',
          success: true,
          userId: 'user-1',
        }),
      })
    );
  });

  it('marks success=false for 4xx responses', async () => {
    const req = createMockRequest();
    const res = createMockResponse(401);
    auditLog('FAILED_ACTION')(req, res, mockNext);
    res.emit('finish');
    await new Promise(r => setTimeout(r, 10));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ success: false }),
      })
    );
  });

  it('sanitizes sensitive fields in body', async () => {
    const req = createMockRequest({
      body: {
        email: 'user@example.com',
        password: 'supersecret',
        jwt_secret: 'mysecret',
        username: 'testuser',
      },
    });
    const res = createMockResponse(200);
    auditLog('USER_UPDATE', { includeBody: true })(req, res, mockNext);
    res.emit('finish');
    await new Promise(r => setTimeout(r, 10));

    const createCall = vi.mocked(prisma.auditLog.create).mock.calls[0]?.[0];
    const details = JSON.parse(createCall?.data?.details as string);
    expect(details.body.password).toBe('********');
    expect(details.body.jwt_secret).toBe('********');
    expect(details.body.email).toBe('user@example.com');
    expect(details.body.username).toBe('testuser');
  });

  it('uses null userId when request has no user', async () => {
    const req = createMockRequest({ user: undefined } as any);
    const res = createMockResponse(200);
    auditLog('ANON_ACTION')(req, res, mockNext);
    res.emit('finish');
    await new Promise(r => setTimeout(r, 10));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: null }),
      })
    );
  });
});

describe('createAuditLogEntry', () => {
  it('creates an audit log entry with provided data', async () => {
    await createAuditLogEntry({
      userId: 'user-1',
      action: 'MANUAL_ACTION',
      resource: '/api/test',
      success: true,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MANUAL_ACTION',
          userId: 'user-1',
          success: true,
        }),
      })
    );
  });
});
