import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Unauthorized'));
    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { isSuspended: true } });
    if (!user || user.isSuspended) return next(new Error('Forbidden'));
    socket.user = payload;
    return next();
  } catch {
    return next(new Error('Invalid token'));
  }
}
