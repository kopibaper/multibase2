import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import AuthService from '../services/AuthService';
import { logger } from '../utils/logger';
import { auditLog } from '../middleware/auditLog';

const prisma = new PrismaClient();

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

export function createOrgRoutes() {
  const router = Router();

  /** Validates session, attaches req.user */
  const requireAuth = async (req: Request, res: Response, next: Function): Promise<any> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const session = await AuthService.validateSession(token);
      if (!session) return res.status(401).json({ error: 'Unauthorized' });
      (req as any).user = session.user;
      next();
    } catch {
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  /** Checks that the authenticated user is a member (or global admin) of the org */
  const checkMembership = async (orgId: string, userId: string, userRole: string) => {
    if (userRole === 'admin') return null; // global admin bypasses membership check
    return prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
  };

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/orgs — list organisations for the current user
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id: userId, role: userRole } = (req as any).user;

      if (userRole === 'admin') {
        // Global admin sees every org — but use their actual membership role if they are a member
        const orgs = await prisma.organisation.findMany({
          include: {
            _count: { select: { members: true } },
            members: { where: { userId }, select: { role: true } },
          },
          orderBy: { name: 'asc' },
        });
        return res.json(
          orgs.map((org) => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            description: org.description,
            createdAt: org.createdAt,
            // Prefer actual membership role (e.g. 'owner') over generic 'admin'
            role: (org.members[0]?.role ?? 'admin') as string,
            memberCount: org._count.members,
          }))
        );
      }

      const memberships = await prisma.orgMember.findMany({
        where: { userId },
        include: {
          org: { include: { _count: { select: { members: true } } } },
        },
        orderBy: { org: { name: 'asc' } },
      });

      return res.json(
        memberships.map((m) => ({
          id: m.org.id,
          name: m.org.name,
          slug: m.org.slug,
          description: m.org.description,
          createdAt: m.org.createdAt,
          role: m.role,
          memberCount: m.org._count.members,
        }))
      );
    } catch (error) {
      logger.error('GET /api/orgs error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/orgs — create a new organisation
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/', requireAuth, auditLog('ORG_CREATE', { includeBody: true }), async (req: Request, res: Response): Promise<any> => {
    try {
      const userId = (req as any).user.id;
      const { name, description } = req.body;

      if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

      let slug = generateSlug(name.trim());
      const existing = await prisma.organisation.findUnique({ where: { slug } });
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;

      const org = await prisma.organisation.create({
        data: {
          name: name.trim(),
          slug,
          description: description?.trim() || null,
          members: { create: { userId, role: 'owner' } },
        },
        include: { _count: { select: { members: true } } },
      });

      return res.status(201).json({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        createdAt: org.createdAt,
        role: 'owner',
        memberCount: org._count.members,
      });
    } catch (error) {
      logger.error('POST /api/orgs error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/orgs/:id — get org details
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<any> => {
    try {
      const { id: userId, role: userRole } = (req as any).user;
      const { id } = req.params;

      const org = await prisma.organisation.findUnique({
        where: { id },
        include: { _count: { select: { members: true } } },
      });
      if (!org) return res.status(404).json({ error: 'Organisation not found' });

      const member = await checkMembership(id, userId, userRole);
      if (member === undefined) return res.status(403).json({ error: 'Not a member' });

      return res.json({
        id: org.id,
        name: org.name,
        slug: org.slug,
        description: org.description,
        createdAt: org.createdAt,
        role: member?.role ?? 'admin',
        memberCount: org._count.members,
      });
    } catch (error) {
      logger.error('GET /api/orgs/:id error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /api/orgs/:id — update org name / description
  // ──────────────────────────────────────────────────────────────────────────
  router.patch('/:id', requireAuth, auditLog('ORG_UPDATE', { includeBody: true }), async (req: Request, res: Response): Promise<any> => {
    try {
      const { id: userId, role: userRole } = (req as any).user;
      const { id } = req.params;
      const { name, description } = req.body;

      const member = await checkMembership(id, userId, userRole);
      if (member === undefined) return res.status(403).json({ error: 'Not a member' });
      if (member !== null && member.role !== 'owner' && member.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const data: Record<string, any> = {};
      if (name?.trim()) {
        data.name = name.trim();
        data.slug = generateSlug(name.trim());
        const collision = await prisma.organisation.findFirst({
          where: { slug: data.slug, NOT: { id } },
        });
        if (collision) data.slug = `${data.slug}-${Date.now().toString(36)}`;
      }
      if (description !== undefined) data.description = description?.trim() || null;

      const org = await prisma.organisation.update({ where: { id }, data });
      return res.json({ ...org, role: member?.role ?? 'admin' });
    } catch (error) {
      logger.error('PATCH /api/orgs/:id error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /api/orgs/:id — delete org (owner only)
  // ──────────────────────────────────────────────────────────────────────────
  router.delete('/:id', requireAuth, auditLog('ORG_DELETE'), async (req: Request, res: Response): Promise<any> => {
    try {
      const { id: userId, role: userRole } = (req as any).user;
      const { id } = req.params;

      const member = await checkMembership(id, userId, userRole);
      if (member === undefined) return res.status(403).json({ error: 'Not a member' });
      if (member !== null && member.role !== 'owner') {
        return res.status(403).json({ error: 'Only the owner can delete the organisation' });
      }

      await prisma.organisation.delete({ where: { id } });
      return res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/orgs/:id error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /api/orgs/:id/members
  // ──────────────────────────────────────────────────────────────────────────
  router.get('/:id/members', requireAuth, async (req: Request, res: Response): Promise<any> => {
    try {
      const { id: userId, role: userRole } = (req as any).user;
      const { id } = req.params;

      const member = await checkMembership(id, userId, userRole);
      if (member === undefined) return res.status(403).json({ error: 'Not a member' });

      const members = await prisma.orgMember.findMany({
        where: { orgId: id },
        include: { user: { select: { id: true, email: true, username: true } } },
        orderBy: { joinedAt: 'asc' },
      });

      return res.json(members);
    } catch (error) {
      logger.error('GET /api/orgs/:id/members error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /api/orgs/:id/members — add member by email
  // ──────────────────────────────────────────────────────────────────────────
  router.post('/:id/members', requireAuth, auditLog('ORG_MEMBER_ADD', { includeBody: true }), async (req: Request, res: Response): Promise<any> => {
    try {
      const { id: userId, role: userRole } = (req as any).user;
      const { id } = req.params;
      const { email, role = 'member' } = req.body;

      if (!email) return res.status(400).json({ error: 'Email is required' });
      if (!['owner', 'admin', 'member', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const member = await checkMembership(id, userId, userRole);
      if (member === undefined) return res.status(403).json({ error: 'Not a member' });
      if (member !== null && member.role !== 'owner' && member.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const targetUser = await prisma.user.findUnique({ where: { email } });
      if (!targetUser) return res.status(404).json({ error: 'No user found with this email' });

      const existing = await prisma.orgMember.findUnique({
        where: { orgId_userId: { orgId: id, userId: targetUser.id } },
      });
      if (existing) return res.status(409).json({ error: 'User is already a member' });

      const newMember = await prisma.orgMember.create({
        data: { orgId: id, userId: targetUser.id, role },
        include: { user: { select: { id: true, email: true, username: true } } },
      });

      return res.status(201).json(newMember);
    } catch (error) {
      logger.error('POST /api/orgs/:id/members error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PATCH /api/orgs/:id/members/:memberId — change role
  // ──────────────────────────────────────────────────────────────────────────
  router.patch('/:id/members/:memberId', requireAuth, auditLog('ORG_MEMBER_ROLE_CHANGE', { includeBody: true }), async (req: Request, res: Response): Promise<any> => {
    try {
      const { id: userId, role: userRole } = (req as any).user;
      const { id, memberId } = req.params;
      const { role } = req.body;

      if (!['owner', 'admin', 'member', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const requester = await checkMembership(id, userId, userRole);
      if (requester === undefined) return res.status(403).json({ error: 'Not a member' });
      if (requester !== null && requester.role !== 'owner' && requester.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const updated = await prisma.orgMember.update({
        where: { id: parseInt(memberId, 10) },
        data: { role },
        include: { user: { select: { id: true, email: true, username: true } } },
      });

      return res.json(updated);
    } catch (error) {
      logger.error('PATCH /api/orgs/:id/members/:memberId error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /api/orgs/:id/members/:memberId — remove member
  // ──────────────────────────────────────────────────────────────────────────
  router.delete('/:id/members/:memberId', requireAuth, auditLog('ORG_MEMBER_REMOVE'), async (req: Request, res: Response): Promise<any> => {
    try {
      const { id: userId, role: userRole } = (req as any).user;
      const { id, memberId } = req.params;

      const requester = await checkMembership(id, userId, userRole);
      if (requester === undefined) return res.status(403).json({ error: 'Not a member' });

      const target = await prisma.orgMember.findUnique({ where: { id: parseInt(memberId, 10) } });
      if (!target) return res.status(404).json({ error: 'Member not found' });

      // Users can always leave themselves; otherwise need owner/admin
      if (target.userId !== userId) {
        if (requester !== null && requester.role !== 'owner' && requester.role !== 'admin') {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        if (target.role === 'owner' && requester?.role !== 'owner') {
          return res.status(403).json({ error: 'Cannot remove the owner' });
        }
      }

      await prisma.orgMember.delete({ where: { id: parseInt(memberId, 10) } });
      return res.json({ success: true });
    } catch (error) {
      logger.error('DELETE /api/orgs/:id/members/:memberId error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
