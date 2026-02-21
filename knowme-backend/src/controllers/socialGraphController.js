import { prisma } from '../config/prisma.js';

export async function toggleFollow(req, res) {
  const followerId = req.user.userId;
  const followingId = req.params.userId;

  if (followerId === followingId) {
    return res.status(400).json({ message: 'No puedes seguirte a ti mismo' });
  }

  const existing = await prisma.socialFollow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });

  if (existing) {
    await prisma.socialFollow.delete({ where: { id: existing.id } });
    return res.json({ following: false });
  }

  await prisma.socialFollow.create({
    data: {
      followerId,
      followingId,
      status: 'FOLLOWING',
    },
  });

  return res.json({ following: true });
}

export async function requestFriend(req, res) {
  const followerId = req.user.userId;
  const followingId = req.params.userId;

  if (followerId === followingId) {
    return res.status(400).json({ message: 'No puedes agregarte como amigo' });
  }

  const relation = await prisma.socialFollow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    update: { status: 'PENDING_FRIEND' },
    create: { followerId, followingId, status: 'PENDING_FRIEND' },
  });

  return res.json(relation);
}

export async function acceptFriend(req, res) {
  const currentUserId = req.user.userId;
  const requesterId = req.params.userId;

  const relation = await prisma.socialFollow.findUnique({
    where: { followerId_followingId: { followerId: requesterId, followingId: currentUserId } },
  });

  if (!relation) return res.status(404).json({ message: 'Solicitud no encontrada' });

  const [accepted, reverse] = await Promise.all([
    prisma.socialFollow.update({
      where: { id: relation.id },
      data: { status: 'FRIEND' },
    }),
    prisma.socialFollow.upsert({
      where: { followerId_followingId: { followerId: currentUserId, followingId: requesterId } },
      update: { status: 'FRIEND' },
      create: { followerId: currentUserId, followingId: requesterId, status: 'FRIEND' },
    }),
  ]);

  return res.json({ accepted, reverse });
}
