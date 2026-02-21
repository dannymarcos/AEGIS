import { prisma } from '../config/prisma.js';

export async function createCallLog({ callType, initiatorId, receiverId, chatId = null }) {
  return prisma.callLog.create({
    data: {
      callType,
      initiatorId,
      receiverId,
      chatId,
      status: 'RINGING',
    },
  });
}

export async function updateCallStatus(callId, status, payload = {}) {
  return prisma.callLog.update({
    where: { id: callId },
    data: {
      status,
      ...payload,
    },
  });
}

export async function getCallForUser(callId, userId) {
  return prisma.callLog.findFirst({
    where: {
      id: callId,
      OR: [{ initiatorId: userId }, { receiverId: userId }],
    },
  });
}

export async function listCallHistory(userId, limit = 100) {
  return prisma.callLog.findMany({
    where: {
      OR: [{ initiatorId: userId }, { receiverId: userId }],
    },
    include: {
      initiator: { select: { id: true, username: true, avatarUrl: true } },
      receiver: { select: { id: true, username: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 200),
  });
}

export function computeDurationSec(startedAt, endedAt = new Date()) {
  if (!startedAt) return 0;
  return Math.max(Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000), 0);
}
