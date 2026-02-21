import { prisma } from '../config/prisma.js';
import { getEligibleAdForPlacement } from '../services/adService.js';
import { calculateEngagementScore } from '../services/engagementService.js';

async function getLatestTrending(shortId, windowMinutes = 1440) {
  return prisma.trendingScore.findFirst({
    where: { shortVideoId: shortId, windowMinutes },
    orderBy: { calculatedAt: 'desc' },
  });
}

export async function createShort(req, res) {
  const { title, caption, videoUrl, thumbnailUrl, durationSec } = req.body;
  if (!title || !videoUrl || !durationSec) {
    return res.status(400).json({ message: 'title, videoUrl y durationSec son requeridos' });
  }

  const short = await prisma.shortVideo.create({
    data: {
      title,
      caption,
      videoUrl,
      thumbnailUrl,
      durationSec,
      ownerId: req.user.userId,
    },
  });

  return res.status(201).json(short);
}

export async function getShortFeed(req, res) {
  const cursor = req.query.cursor || null;
  const limit = Math.min(Number(req.query.limit || 5), 20);
  const userId = req.user?.userId || null;

  const shorts = await prisma.shortVideo.findMany({
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: [{ createdAt: 'desc' }],
    include: { owner: { select: { id: true, username: true, avatarUrl: true } } },
  });

  const formatted = await Promise.all(shorts.map(async (short) => {
    const [viewCount, watchAgg, trending] = await Promise.all([
      prisma.watchSession.count({ where: { shortVideoId: short.id } }),
      prisma.watchSession.aggregate({ where: { shortVideoId: short.id }, _sum: { watchedMs: true } }),
      getLatestTrending(short.id),
    ]);

    const likeCount = 0;
    const commentCount = 0;

    const watchedMs = watchAgg._sum.watchedMs || 0;
    const engagementScore = calculateEngagementScore({
      watchedMs,
      durationSec: short.durationSec,
      likeCount,
      commentCount,
      viewCount,
    });

    return {
      ...short,
      metrics: {
        viewCount,
        likeCount,
        commentCount,
        watchMs: watchedMs,
        engagementScore,
        trendingScore: trending?.score || 0,
      },
    };
  }));

  const ad = userId ? await getEligibleAdForPlacement({ userId, placement: 'YOUTUBE' }) : null;

  return res.json({
    items: formatted,
    nextCursor: shorts.length === limit ? shorts[shorts.length - 1].id : null,
    ad,
  });
}

export async function trackShortWatch(req, res) {
  const { watchedMs = 0 } = req.body;
  const shortId = req.params.shortId;

  const short = await prisma.shortVideo.findUnique({ where: { id: shortId } });
  if (!short) return res.status(404).json({ message: 'Short no encontrado' });

  const completionRate = Math.min(Number(watchedMs) / Math.max(short.durationSec * 1000, 1), 1.5);

  const session = await prisma.watchSession.create({
    data: {
      shortVideoId: shortId,
      userId: req.user?.userId || null,
      watchedMs: Number(watchedMs),
      completionRate,
    },
  });

  return res.status(201).json(session);
}

export async function refreshShortTrending(_req, res) {
  const shorts = await prisma.shortVideo.findMany({ select: { id: true, durationSec: true } });

  const rows = await Promise.all(shorts.map(async (short) => {
    const [viewCount, watchAgg] = await Promise.all([
      prisma.watchSession.count({ where: { shortVideoId: short.id } }),
      prisma.watchSession.aggregate({ where: { shortVideoId: short.id }, _sum: { watchedMs: true } }),
    ]);

    const likeCount = 0;
    const commentCount = 0;

    const score = calculateEngagementScore({
      watchedMs: watchAgg._sum.watchedMs || 0,
      durationSec: short.durationSec,
      likeCount,
      commentCount,
      viewCount,
    });

    return prisma.trendingScore.create({
      data: {
        shortVideoId: short.id,
        score,
        windowMinutes: 1440,
      },
    });
  }));

  await Promise.all(rows);
  return res.json({ updated: rows.length });
}
