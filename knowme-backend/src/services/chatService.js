import { prisma } from '../config/prisma.js';

export async function ensureParticipant(chatId, userId) {
  const participant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  return participant;
}

export async function getChatWithAccess(chatId, userId) {
  const participant = await ensureParticipant(chatId, userId);
  if (!participant) return null;
  return prisma.chat.findUnique({
    where: { id: chatId },
    include: {
      participants: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
    },
  });
}

export async function createDirectChat(userA, userB) {
  const candidates = await prisma.chat.findMany({
    where: {
      type: 'DIRECT',
      participants: {
        some: { userId: userA },
      },
    },
    include: { participants: true },
  });

  const existing = candidates.find((chat) => {
    if (chat.participants.length !== 2) return false;
    const ids = new Set(chat.participants.map((p) => p.userId));
    return ids.has(userA) && ids.has(userB);
  });

  if (existing) return existing;

  return prisma.chat.create({
    data: {
      type: 'DIRECT',
      createdById: userA,
      participants: {
        create: [{ userId: userA, role: 'ADMIN' }, { userId: userB, role: 'MEMBER' }],
      },
    },
    include: { participants: true },
  });
}

export async function markReadUpTo(chatId, userId, messageId) {
  const pivot = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!pivot || pivot.chatId !== chatId) return 0;

  const messages = await prisma.chatMessage.findMany({
    where: { chatId, createdAt: { lte: pivot.createdAt } },
    select: { id: true },
  });

  await Promise.all(messages.map((message) => prisma.chatReadReceipt.upsert({
    where: { messageId_userId: { messageId: message.id, userId } },
    update: { readAt: new Date() },
    create: { messageId: message.id, userId },
  })));

  await prisma.chatParticipant.update({
    where: { chatId_userId: { chatId, userId } },
    data: { lastReadAt: new Date() },
  }).catch(() => {});

  return messages.length;
}
