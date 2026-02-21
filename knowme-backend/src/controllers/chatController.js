import { prisma } from '../config/prisma.js';
import { createDirectChat, getChatWithAccess, markReadUpTo } from '../services/chatService.js';

export async function createOrGetDirectChat(req, res) {
  const peerUserId = req.body.peerUserId;
  if (!peerUserId) return res.status(400).json({ message: 'peerUserId requerido' });
  if (peerUserId === req.user.userId) return res.status(400).json({ message: 'No válido' });

  const chat = await createDirectChat(req.user.userId, peerUserId);
  return res.status(201).json(chat);
}

export async function createGroupChat(req, res) {
  const { title, participantIds = [] } = req.body;
  const unique = [...new Set([req.user.userId, ...participantIds])];
  if (unique.length < 3) return res.status(400).json({ message: 'Grupo requiere >=3 usuarios' });

  const chat = await prisma.chat.create({
    data: {
      type: 'GROUP',
      title: title || 'New Group',
      createdById: req.user.userId,
      participants: {
        create: unique.map((id) => ({ userId: id, role: id === req.user.userId ? 'ADMIN' : 'MEMBER' })),
      },
    },
    include: { participants: { include: { user: { select: { id: true, username: true } } } } },
  });

  return res.status(201).json(chat);
}

export async function listMyChats(req, res) {
  const chats = await prisma.chat.findMany({
    where: { participants: { some: { userId: req.user.userId } } },
    orderBy: { updatedAt: 'desc' },
    include: {
      participants: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
      messages: { take: 1, orderBy: { createdAt: 'desc' }, include: { sender: { select: { id: true, username: true } } } },
    },
  });

  return res.json(chats);
}

export async function getChatMessages(req, res) {
  const chat = await getChatWithAccess(req.params.chatId, req.user.userId);
  if (!chat) return res.status(403).json({ message: 'Sin acceso' });

  const messages = await prisma.chatMessage.findMany({
    where: { chatId: req.params.chatId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
      reactions: true,
      readReceipts: true,
    },
    take: Math.min(Number(req.query.limit || 100), 200),
  });

  return res.json({ chat, messages });
}

export async function addReaction(req, res) {
  const { messageId } = req.params;
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ message: 'emoji requerido' });

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) return res.status(404).json({ message: 'Mensaje no encontrado' });

  const member = await prisma.chatParticipant.findUnique({ where: { chatId_userId: { chatId: message.chatId, userId: req.user.userId } } });
  if (!member) return res.status(403).json({ message: 'Sin acceso' });

  const reaction = await prisma.chatReaction.upsert({
    where: { messageId_userId_emoji: { messageId, userId: req.user.userId, emoji } },
    update: {},
    create: { messageId, userId: req.user.userId, emoji },
  });

  return res.status(201).json(reaction);
}

export async function removeReaction(req, res) {
  const { messageId } = req.params;
  const { emoji } = req.body;

  await prisma.chatReaction.deleteMany({ where: { messageId, userId: req.user.userId, emoji } });
  return res.json({ removed: true });
}

export async function markChatRead(req, res) {
  const { chatId } = req.params;
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ message: 'messageId requerido' });

  const count = await markReadUpTo(chatId, req.user.userId, messageId);
  return res.json({ updatedReceipts: count });
}

export async function deleteForEveryone(req, res) {
  const { messageId } = req.params;
  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) return res.status(404).json({ message: 'Mensaje no encontrado' });
  if (message.senderId !== req.user.userId) return res.status(403).json({ message: 'Solo emisor puede borrar para todos' });

  const updated = await prisma.chatMessage.update({
    where: { id: messageId },
    data: {
      deletedForEveryone: true,
      deletedAt: new Date(),
      text: null,
      mediaUrl: null,
      messageType: 'DELETED',
    },
  });

  return res.json(updated);
}
