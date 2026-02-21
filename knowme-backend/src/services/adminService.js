import { prisma } from '../config/prisma.js';

export async function getAdminAnalytics({ days = 30 }) {
  const rangeDays = Math.max(1, Math.min(Number(days) || 30, 365));
  const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const [usersTotal, usersNew, activeVideos, activeShorts, socialPosts, openReports, revenues] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: from } } }),
    prisma.video.count({ where: { createdAt: { gte: from } } }),
    prisma.shortVideo.count({ where: { createdAt: { gte: from } } }),
    prisma.socialPost.count({ where: { createdAt: { gte: from } } }),
    prisma.moderationReport.count({ where: { status: 'OPEN' } }),
    prisma.revenueLedger.groupBy({
      by: ['sourceType'],
      where: { createdAt: { gte: from } },
      _sum: { grossRevenueUsd: true, creatorShareUsd: true, platformShareUsd: true },
    }),
  ]);

  return {
    rangeDays,
    users: { total: usersTotal, newInRange: usersNew },
    content: { videos: activeVideos, shorts: activeShorts, posts: socialPosts },
    moderation: { openReports },
    revenue: revenues.map((r) => ({
      sourceType: r.sourceType,
      grossRevenueUsd: Number(r._sum.grossRevenueUsd || 0),
      creatorShareUsd: Number(r._sum.creatorShareUsd || 0),
      platformShareUsd: Number(r._sum.platformShareUsd || 0),
    })),
  };
}

export async function setUserSuspension({ userId, suspend, reason, moderatorId }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isSuspended: Boolean(suspend),
      suspendedReason: suspend ? reason || 'Moderation action' : null,
    },
  });

  const report = await prisma.moderationReport.create({
    data: {
      reportType: 'SYSTEM',
      targetType: 'USER',
      targetId: userId,
      reason: suspend ? reason || 'Suspended by admin' : 'Unsuspended by admin',
      status: 'RESOLVED',
      reportedUserId: userId,
      actions: {
        create: {
          moderatorId,
          actionType: suspend ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
          note: reason || null,
        },
      },
    },
    include: { actions: true },
  });

  return { user, report };
}

export async function listModerationReports({ status = 'OPEN', take = 100 }) {
  return prisma.moderationReport.findMany({
    where: status === 'ALL' ? {} : { status },
    include: {
      reporter: { select: { id: true, username: true, email: true } },
      reportedUser: { select: { id: true, username: true, email: true } },
      actions: true,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(take) || 100, 200),
  });
}
