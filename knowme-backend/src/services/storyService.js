import { prisma } from '../config/prisma.js';

export async function cleanupExpiredStories() {
  const now = new Date();
  const result = await prisma.socialStory.deleteMany({ where: { expiresAt: { lte: now } } });
  return result.count;
}

export function defaultStoryExpiry() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}
