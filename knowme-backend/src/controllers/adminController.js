import { prisma } from '../config/prisma.js';
import { getAdminAnalytics, listModerationReports, setUserSuspension } from '../services/adminService.js';
import { getOrCreateMonetizationConfig } from '../services/monetizationService.js';

export async function getAnalytics(req, res) {
  const days = Number(req.query.days || 30);
  const analytics = await getAdminAnalytics({ days });
  return res.json(analytics);
}

export async function getRevenueTracking(req, res) {
  const days = Math.max(1, Math.min(Number(req.query.days || 30), 365));
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [rows, config] = await Promise.all([
    prisma.revenueLedger.findMany({
      where: { createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
      include: {
        ownerUser: { select: { id: true, username: true, email: true } },
      },
      take: 500,
    }),
    getOrCreateMonetizationConfig(),
  ]);

  return res.json({ days, creatorSharePct: Number(config.creatorSharePct), rows });
}

export async function moderateUser(req, res) {
  const { userId } = req.params;
  const { suspend, reason } = req.body;
  const result = await setUserSuspension({
    userId,
    suspend: Boolean(suspend),
    reason,
    moderatorId: req.user.userId,
  });
  return res.json(result);
}

export async function getUsers(req, res) {
  const take = Math.min(Number(req.query.take || 100), 200);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isSuspended: true,
      suspendedReason: true,
      createdAt: true,
    },
  });
  return res.json(users);
}

export async function updateUserRole(req, res) {
  const { userId } = req.params;
  const { role } = req.body;
  if (!['USER', 'ADMIN'].includes(role)) {
    return res.status(400).json({ message: 'role inválido' });
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { role } });
  return res.json({ id: user.id, role: user.role });
}

export async function getModerationQueue(req, res) {
  const status = (req.query.status || 'OPEN').toString().toUpperCase();
  const reports = await listModerationReports({ status, take: req.query.take });
  return res.json(reports);
}

export async function createModerationReport(req, res) {
  const { targetType, targetId, reason, reportedUserId } = req.body;
  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ message: 'targetType, targetId y reason son requeridos' });
  }

  const report = await prisma.moderationReport.create({
    data: {
      reportType: 'USER',
      targetType,
      targetId,
      reason,
      reporterId: req.user.userId,
      reportedUserId: reportedUserId || null,
    },
  });

  return res.status(201).json(report);
}
