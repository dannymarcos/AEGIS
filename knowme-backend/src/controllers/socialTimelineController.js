import { prisma } from '../config/prisma.js';
import { cleanupExpiredStories } from '../services/storyService.js';
import { getEligibleAdForPlacement } from '../services/adService.js';

export async function getTimeline(req, res) {
  const userId = req.user.userId;
  const limit = Math.min(Number(req.query.limit || 20), 50);
  const cursor = req.query.cursor || null;
  const query = String(req.query.q || '').trim();

  await cleanupExpiredStories();

  const followingRows = await prisma.socialFollow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });

  const userIds = [userId, ...followingRows.map((row) => row.followingId)];

  const posts = await prisma.socialPost.findMany({
    where: {
      authorId: { in: userIds },
      ...(query ? {
        OR: [
          { content: { contains: query, mode: 'insensitive' } },
          { hashtags: { some: { hashtag: { tag: { contains: query.toLowerCase(), mode: 'insensitive' } } } } },
        ],
      } : {}),
    },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      media: { orderBy: { position: 'asc' } },
      likes: true,
      comments: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
      hashtags: { include: { hashtag: true } },
      mentions: { include: { mentionedUser: { select: { id: true, username: true } } } },
    },
  });

  const stories = await prisma.socialStory.findMany({
    where: {
      authorId: { in: userIds },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      likes: true,
      mentions: { include: { mentionedUser: { select: { id: true, username: true } } } },
    },
  });

  const ad = await getEligibleAdForPlacement({ userId, placement: 'SOCIAL' });

  return res.json({
    stories,
    posts,
    ad,
    nextCursor: posts.length === limit ? posts[posts.length - 1].id : null,
  });
}
