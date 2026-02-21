import { Server } from 'socket.io';
import { prisma } from './config/prisma.js';
import { authenticateSocket } from './middleware/socketAuth.js';
import { ensureParticipant, markReadUpTo } from './services/chatService.js';
import { computeDurationSec, createCallLog, getCallForUser, updateCallStatus } from './services/callService.js';

async function setPresence(userId, status, socketId = null) {
  await prisma.userPresence.create({
    data: { userId, status, socketId, lastSeenAt: new Date() },
  });
}

async function isPeerAllowed(callerId, receiverId, chatId = null) {
  if (chatId) {
    const callerMember = await prisma.chatParticipant.findUnique({ where: { chatId_userId: { chatId, userId: callerId } } });
    const receiverMember = await prisma.chatParticipant.findUnique({ where: { chatId_userId: { chatId, userId: receiverId } } });
    return Boolean(callerMember && receiverMember);
  }

  const direct = await prisma.chat.findMany({
    where: { type: 'DIRECT', participants: { some: { userId: callerId } } },
    include: { participants: true },
  });
  return direct.some((chat) => chat.participants.length === 2 && chat.participants.some((p) => p.userId === receiverId));
}

export function setupSocket(httpServer, corsOrigin = '*') {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  });

  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const userId = socket.user.userId;
    socket.join(`user:${userId}`);
    await setPresence(userId, 'ONLINE', socket.id);
    io.emit('presence:update', { userId, status: 'ONLINE' });

    const memberships = await prisma.chatParticipant.findMany({ where: { userId }, select: { chatId: true } });
    memberships.forEach(({ chatId }) => socket.join(`chat:${chatId}`));

    socket.on('chat:join', async ({ chatId }) => {
      const participant = await ensureParticipant(chatId, userId);
      if (participant) socket.join(`chat:${chatId}`);
    });

    socket.on('chat:typing', async ({ chatId, isTyping }) => {
      const participant = await ensureParticipant(chatId, userId);
      if (!participant) return;
      socket.to(`chat:${chatId}`).emit('chat:typing', { chatId, userId, isTyping: Boolean(isTyping) });
    });

    socket.on('chat:message:send', async (payload, ack) => {
      try {
        const {
          chatId,
          messageType = 'TEXT',
          voiceDurationSec = null,
          encryptedPayload,
          encryptionIv,
          encryptionAlg = 'AES-GCM',
          encryptionVersion = 1,
        } = payload || {};

        if (!chatId || !encryptedPayload || !encryptionIv) {
          return ack?.({ ok: false, error: 'Encrypted payload requerido' });
        }

        const participant = await ensureParticipant(chatId, userId);
        if (!participant) return ack?.({ ok: false, error: 'Forbidden' });

        const message = await prisma.chatMessage.create({
          data: {
            chatId,
            senderId: userId,
            messageType,
            text: null,
            mediaUrl: null,
            voiceDurationSec,
            encryptedPayload,
            encryptionIv,
            encryptionAlg,
            encryptionVersion,
          },
          include: {
            sender: { select: { id: true, username: true, avatarUrl: true } },
            reactions: true,
            readReceipts: true,
          },
        });

        await prisma.chat.update({ where: { id: chatId }, data: { updatedAt: new Date() } });
        io.to(`chat:${chatId}`).emit('chat:message:new', message);
        ack?.({ ok: true, message });
      } catch {
        ack?.({ ok: false, error: 'Message send failed' });
      }
    });

    socket.on('chat:message:read', async ({ chatId, messageId }, ack) => {
      try {
        const participant = await ensureParticipant(chatId, userId);
        if (!participant) return ack?.({ ok: false, error: 'Forbidden' });
        await markReadUpTo(chatId, userId, messageId);
        io.to(`chat:${chatId}`).emit('chat:read:update', { chatId, userId, messageId, readAt: new Date().toISOString() });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'Read update failed' });
      }
    });

    socket.on('chat:message:reaction', async ({ messageId, emoji }, ack) => {
      try {
        const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
        if (!message) return ack?.({ ok: false, error: 'Message not found' });
        const participant = await ensureParticipant(message.chatId, userId);
        if (!participant) return ack?.({ ok: false, error: 'Forbidden' });

        const reaction = await prisma.chatReaction.upsert({
          where: { messageId_userId_emoji: { messageId, userId, emoji } },
          update: {},
          create: { messageId, userId, emoji },
        });

        io.to(`chat:${message.chatId}`).emit('chat:reaction:update', { chatId: message.chatId, messageId, reaction });
        ack?.({ ok: true, reaction });
      } catch {
        ack?.({ ok: false, error: 'Reaction failed' });
      }
    });

    socket.on('chat:message:deleteForEveryone', async ({ messageId }, ack) => {
      try {
        const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
        if (!message) return ack?.({ ok: false, error: 'Message not found' });
        if (message.senderId !== userId) return ack?.({ ok: false, error: 'Forbidden' });

        const updated = await prisma.chatMessage.update({
          where: { id: messageId },
          data: {
            deletedForEveryone: true,
            deletedAt: new Date(),
            text: null,
            mediaUrl: null,
            encryptedPayload: null,
            encryptionIv: null,
            messageType: 'DELETED',
          },
        });

        io.to(`chat:${message.chatId}`).emit('chat:message:deleted', { chatId: message.chatId, message: updated });
        ack?.({ ok: true, message: updated });
      } catch {
        ack?.({ ok: false, error: 'Delete failed' });
      }
    });

    socket.on('call:initiate', async ({ receiverId, callType = 'AUDIO', chatId = null, encryptedOffer }, ack) => {
      try {
        if (!receiverId || !encryptedOffer) return ack?.({ ok: false, error: 'receiverId y encryptedOffer requeridos' });
        if (!['AUDIO', 'VIDEO'].includes(callType)) return ack?.({ ok: false, error: 'callType inválido' });
        if (receiverId === userId) return ack?.({ ok: false, error: 'No válido' });

        const allowed = await isPeerAllowed(userId, receiverId, chatId);
        if (!allowed) return ack?.({ ok: false, error: 'Peer not allowed' });

        const call = await createCallLog({ callType, initiatorId: userId, receiverId, chatId });
        socket.join(`call:${call.id}`);

        io.to(`user:${receiverId}`).emit('call:incoming', {
          callId: call.id,
          chatId,
          callType,
          fromUserId: userId,
          encryptedOffer,
          createdAt: call.createdAt,
        });

        ack?.({ ok: true, callId: call.id });
      } catch {
        ack?.({ ok: false, error: 'Call initiate failed' });
      }
    });

    socket.on('call:accept', async ({ callId, encryptedAnswer }, ack) => {
      try {
        const call = await getCallForUser(callId, userId);
        if (!call) return ack?.({ ok: false, error: 'Call not found' });
        if (call.receiverId !== userId) return ack?.({ ok: false, error: 'Forbidden' });

        const updated = await updateCallStatus(callId, 'ONGOING', { startedAt: new Date() });
        socket.join(`call:${callId}`);
        io.to(`user:${updated.initiatorId}`).emit('call:accepted', { callId, encryptedAnswer, startedAt: updated.startedAt });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'Accept failed' });
      }
    });

    socket.on('call:reject', async ({ callId, reason = 'REJECTED' }, ack) => {
      try {
        const call = await getCallForUser(callId, userId);
        if (!call) return ack?.({ ok: false, error: 'Call not found' });
        if (call.receiverId !== userId) return ack?.({ ok: false, error: 'Forbidden' });

        await updateCallStatus(callId, 'REJECTED', { endedAt: new Date(), endReason: reason });
        io.to(`user:${call.initiatorId}`).emit('call:rejected', { callId, reason });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'Reject failed' });
      }
    });

    socket.on('call:ice-candidate', async ({ callId, encryptedCandidate }, ack) => {
      try {
        const call = await getCallForUser(callId, userId);
        if (!call) return ack?.({ ok: false, error: 'Call not found' });
        const targetUserId = call.initiatorId === userId ? call.receiverId : call.initiatorId;
        io.to(`user:${targetUserId}`).emit('call:ice-candidate', { callId, fromUserId: userId, encryptedCandidate });
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'ICE relay failed' });
      }
    });

    socket.on('call:end', async ({ callId, reason = 'ENDED' }, ack) => {
      try {
        const call = await getCallForUser(callId, userId);
        if (!call) return ack?.({ ok: false, error: 'Call not found' });

        const endedAt = new Date();
        const durationSec = computeDurationSec(call.startedAt, endedAt);
        const updated = await updateCallStatus(callId, 'ENDED', {
          endedAt,
          durationSec,
          endReason: reason,
        });

        const targetUserId = updated.initiatorId === userId ? updated.receiverId : updated.initiatorId;
        io.to(`user:${targetUserId}`).emit('call:ended', { callId, reason, durationSec });
        ack?.({ ok: true, durationSec });
      } catch {
        ack?.({ ok: false, error: 'End failed' });
      }
    });

    socket.on('disconnect', async () => {
      await setPresence(userId, 'OFFLINE', null);
      io.emit('presence:update', { userId, status: 'OFFLINE', lastSeenAt: new Date().toISOString() });
    });
  });

  return io;
}
