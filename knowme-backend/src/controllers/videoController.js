import { prisma } from '../config/prisma.js';
import { getEligibleAdForPlacement } from '../services/adService.js';

export async function createVideo(req, res) {
  const { title, description, videoUrl, thumbnailUrl, durationSec } = req.body;
  const video = await prisma.video.create({
    data: {
      title,
      description,
      videoUrl,
      thumbnailUrl,
      durationSec,
      ownerId: req.user.userId,
    },
  });
  return res.status(201).json(video);
}

export async function listVideos(req, res) {
  const limit = Math.min(Number(req.query.limit || 24), 50);
  const query = String(req.query.q || '').trim();
  const where = query ? {
    OR: [
      { title: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
    ],
  } : undefined;

  const videos = await prisma.video.findMany({
    where,
    include: { owner: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const ad = req.user?.userId ? await getEligibleAdForPlacement({ userId: req.user.userId, placement: 'YOUTUBE' }) : null;
  return res.json({ items: videos, ad });
}

export async function getVideo(req, res) {
  const video = await prisma.video.findUnique({
    where: { id: req.params.id },
    include: { owner: true, comments: true, likes: true, views: true },
  });
  if (!video) return res.status(404).json({ message: 'Video no encontrado' });
  return res.json(video);
}

export async function addView(req, res) {
  const view = await prisma.view.create({
    data: {
      videoId: req.params.id,
      userId: req.user?.userId || null,
      watchMs: req.body?.watchMs,
    },
  });
  return res.status(201).json(view);
}

export async function toggleLike(req, res) {
  const existing = await prisma.like.findUnique({
    where: { userId_videoId: { userId: req.user.userId, videoId: req.params.id } },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
    return res.json({ liked: false });
  }

  await prisma.like.create({ data: { userId: req.user.userId, videoId: req.params.id } });
  return res.json({ liked: true });
}
