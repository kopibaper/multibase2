import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import prisma from '../../lib/prisma';

// Mock EmailService to avoid SMTP errors in tests
vi.mock('../../services/EmailService', () => ({
  default: {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mocks are set up
import AuthService from '../../services/AuthService';

// The singleton instance exported from the module
let service: typeof AuthService;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../../services/AuthService');
  service = mod.default;
});

describe('AuthService', () => {
  describe('register', () => {
    it('throws if user with same email already exists', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: 'existing',
        email: 'user@test.com',
      } as any);

      await expect(
        service.register({
          email: 'user@test.com',
          username: 'newuser',
          password: 'Admin123!',
        })
      ).rejects.toThrow('already exists');
    });

    it('creates user and returns user data without passwordHash', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce(null);
      vi.mocked(prisma.user.create).mockResolvedValueOnce({
        id: 'new-user',
        email: 'user@test.com',
        username: 'newuser',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
      } as any);

      const result = await service.register({
        email: 'user@test.com',
        username: 'newuser',
        password: 'Admin123!',
      });

      expect(result).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalledOnce();
      // Ensure passwordHash is not returned
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('login', () => {
    it('throws for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'unknown@test.com', password: 'Admin123!' })
      ).rejects.toThrow();
    });

    it('throws for wrong password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'u1',
        email: 'user@test.com',
        passwordHash: await bcrypt.hash('correct-password', 10),
        isActive: true,
        twoFactorEnabled: false,
        role: 'user',
      } as any);

      await expect(
        service.login({ email: 'user@test.com', password: 'wrong-password' })
      ).rejects.toThrow();
    });

    it('creates session for valid credentials', async () => {
      const hash = await bcrypt.hash('Admin123!', 10);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'u1',
        email: 'user@test.com',
        username: 'testuser',
        passwordHash: hash,
        isActive: true,
        twoFactorEnabled: false,
        role: 'user',
        avatar: null,
      } as any);

      vi.mocked(prisma.session.create).mockResolvedValueOnce({
        id: 's1',
        userId: 'u1',
        token: 'session-token',
        expiresAt: new Date(Date.now() + 3600000),
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      } as any);

      const result = await service.login({ email: 'user@test.com', password: 'Admin123!' });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('session');
      expect(prisma.session.create).toHaveBeenCalledOnce();
    });
  });

  describe('validateSession', () => {
    it('returns null for non-existent session', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValueOnce(null);
      const result = await service.validateSession('nonexistent-token');
      expect(result).toBeNull();
    });

    it('returns session data for valid token', async () => {
      vi.mocked(prisma.session.findUnique).mockResolvedValueOnce({
        id: 's1',
        userId: 'u1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 3600000),
        user: {
          id: 'u1',
          email: 'user@test.com',
          username: 'testuser',
          role: 'user',
          isActive: true,
          avatar: null,
          twoFactorEnabled: false,
        },
      } as any);

      const result = await service.validateSession('valid-token');
      expect(result).not.toBeNull();
      expect(result?.user.email).toBe('user@test.com');
    });
  });
});
