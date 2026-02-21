import { prisma } from '../config/prisma.js';
import { extractHashtags, extractMentions, inferPostType } from '../services/socialParserService.js';

async function connectHashtags(postId, content) {
  const tags = extractHashtags(content);
  for (const tag of tags) {
    const hashtag = await prisma.hashtag.upsert({
      where: { tag },
      update: {},
      create: { tag },
    });

    await prisma.socialPostHashtag.upsert({
      where: { postId_hashtagId: { postId, hashtagId: hashtag.id } },
      update: {},
      create: { postId, hashtagId: hashtag.id },
    });
  }
}

async function connectMentionsToPost(postId, content) {
  const mentions = extractMentions(content);
  for (const username of mentions) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) continue;
    await prisma.socialPostMention.upsert({
      where: { postId_mentionedUserId: { postId, mentionedUserId: user.id } },
      update: {},
      create: { postId, mentionedUserId: user.id },
    });
  }
}

export async function createPost(req, res) {
  const { content = '', media = [] } = req.body;

  if (!content && (!Array.isArray(media) || media.length === 0)) {
    return res.status(400).json({ message: 'Debes enviar texto o media' });
  }

  const postType = inferPostType(media);

  const post = await prisma.socialPost.create({
    data: {
      authorId: req.user.userId,
      content,
      postType,
      media: {
        create: (media || []).map((item, idx) => ({
          mediaUrl: item.mediaUrl,
          mediaType: item.mediaType || 'IMAGE',
          position: idx,
        })),
      },
    },
    include: { author: { select: { id: true, username: true, avatarUrl: true } }, media: true },
  });

  await connectHashtags(post.id, content);
  await connectMentionsToPost(post.id, content);

  return res.status(201).json(post);
}

export async function getPostById(req, res) {
  const post = await prisma.socialPost.findUnique({
    where: { id: req.params.postId },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      media: { orderBy: { position: 'asc' } },
      likes: true,
      comments: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
      hashtags: { include: { hashtag: true } },
      mentions: { include: { mentionedUser: { select: { id: true, username: true } } } },
    },
  });

  if (!post) return res.status(404).json({ message: 'Post no encontrado' });
  return res.json(post);
}

export async function togglePostLike(req, res) {
  const postId = req.params.postId;
  const userId = req.user.userId;

  const existing = await prisma.socialLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });

  if (existing) {
    await prisma.socialLike.delete({ where: { id: existing.id } });
    return res.json({ liked: false });
  }

  await prisma.socialLike.create({ data: { postId, userId } });
  return res.json({ liked: true });
}

export async function createPostComment(req, res) {
  const postId = req.params.postId;
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: 'Comentario requerido' });

  const comment = await prisma.socialComment.create({
    data: {
      postId,
      userId: req.user.userId,
      content,
    },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });

  return res.status(201).json(comment);
}

export async function listPostComments(req, res) {
  const postId = req.params.postId;
  const comments = await prisma.socialComment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });

  return res.json(comments);
}
