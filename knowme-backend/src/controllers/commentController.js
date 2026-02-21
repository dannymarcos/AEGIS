import { prisma } from '../config/prisma.js';

export async function createComment(req, res) {
  const { content } = req.body;
  const comment = await prisma.comment.create({
    data: {
      content,
      videoId: req.params.videoId,
      userId: req.user.userId,
    },
    include: { user: true },
  });

  return res.status(201).json(comment);
}

export async function listComments(req, res) {
  const comments = await prisma.comment.findMany({
    where: { videoId: req.params.videoId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(comments);
}
