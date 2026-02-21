import { prisma } from '../config/prisma.js';
import { cleanupExpiredStories, defaultStoryExpiry } from '../services/storyService.js';
import { extractMentions } from '../services/socialParserService.js';

async function connectMentionsToStory(storyId, content) {
  const mentions = extractMentions(content || '');
  for (const username of mentions) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) continue;
    await prisma.socialStoryMention.upsert({
      where: { storyId_mentionedUserId: { storyId, mentionedUserId: user.id } },
      update: {},
      create: { storyId, mentionedUserId: user.id },
    });
  }
}

export async function createStory(req, res) {
  const { content = '', mediaUrl = null, mediaType = 'TEXT' } = req.body;
  if (!content && !mediaUrl) {
    return res.status(400).json({ message: 'Debes enviar contenido de texto o media' });
  }

  const story = await prisma.socialStory.create({
    data: {
      authorId: req.user.userId,
      content,
      mediaUrl,
      mediaType,
      expiresAt: defaultStoryExpiry(),
    },
    include: { author: { select: { id: true, username: true, avatarUrl: true } } },
  });

  await connectMentionsToStory(story.id, content);

  return res.status(201).json(story);
}

export async function listActiveStories(req, res) {
  await cleanupExpiredStories();

  const stories = await prisma.socialStory.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      likes: true,
      mentions: { include: { mentionedUser: { select: { id: true, username: true } } } },
    },
  });

  return res.json(stories);
}

export async function toggleStoryLike(req, res) {
  const storyId = req.params.storyId;
  const userId = req.user.userId;

  const existing = await prisma.socialStoryLike.findUnique({
    where: { storyId_userId: { storyId, userId } },
  });

  if (existing) {
    await prisma.socialStoryLike.delete({ where: { id: existing.id } });
    return res.json({ liked: false });
  }

  await prisma.socialStoryLike.create({ data: { storyId, userId } });
  return res.json({ liked: true });
}

export async function cleanupStoriesNow(_req, res) {
  const deletedCount = await cleanupExpiredStories();
  return res.json({ deletedCount });
}
