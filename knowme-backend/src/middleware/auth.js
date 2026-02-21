import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

function readToken(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

export function attachUserIfPresent(req, _res, next) {
  const token = readToken(req);
  if (!token) return next();

  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
  } catch {
    req.user = undefined;
  }
  return next();
}

export async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { isSuspended: true, suspendedReason: true },
    });
    if (!user) return res.status(401).json({ message: 'Unauthorized' });
    if (user.isSuspended) {
      return res.status(403).json({ message: 'Account suspended', reason: user.suspendedReason });
    }
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });
  return next();
}

export async function requireActiveUser(req, res, next) {
  if (!req.user?.userId) return res.status(401).json({ message: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { isSuspended: true, suspendedReason: true } });
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  if (user.isSuspended) return res.status(403).json({ message: 'Account suspended', reason: user.suspendedReason });
  return next();
}
