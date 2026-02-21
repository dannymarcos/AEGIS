import { prisma } from '../config/prisma.js';

export async function upsertMyPublicKey(req, res) {
  const { publicKey, algorithm = 'RSA-OAEP-2048' } = req.body;
  if (!publicKey) return res.status(400).json({ message: 'publicKey requerido' });

  const row = await prisma.userCryptoKey.upsert({
    where: { userId: req.user.userId },
    update: { publicKey, algorithm },
    create: { userId: req.user.userId, publicKey, algorithm },
  });

  return res.json(row);
}

export async function getUserPublicKey(req, res) {
  const row = await prisma.userCryptoKey.findUnique({ where: { userId: req.params.userId } });
  if (!row) return res.status(404).json({ message: 'Public key no encontrada' });
  return res.json(row);
}

export async function upsertChatKeyEnvelopes(req, res) {
  const { chatId, keyVersion = 1, envelopes = [] } = req.body;
  if (!chatId || !Array.isArray(envelopes) || envelopes.length === 0) {
    return res.status(400).json({ message: 'chatId y envelopes requeridos' });
  }

  const participant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId: req.user.userId } },
  });
  if (!participant) return res.status(403).json({ message: 'Sin acceso al chat' });

  const writes = envelopes.map((entry) => prisma.chatKeyEnvelope.upsert({
    where: {
      chatId_userId_keyVersion: {
        chatId,
        userId: entry.userId,
        keyVersion,
      },
    },
    update: { encryptedKey: entry.encryptedKey },
    create: {
      chatId,
      userId: entry.userId,
      keyVersion,
      encryptedKey: entry.encryptedKey,
    },
  }));

  const rows = await Promise.all(writes);
  return res.json(rows);
}

export async function getMyChatEnvelope(req, res) {
  const chatId = req.params.chatId;
  const keyVersion = Number(req.query.keyVersion || 1);

  const row = await prisma.chatKeyEnvelope.findUnique({
    where: {
      chatId_userId_keyVersion: {
        chatId,
        userId: req.user.userId,
        keyVersion,
      },
    },
  });

  if (!row) return res.status(404).json({ message: 'Envelope no encontrado' });
  return res.json(row);
}
