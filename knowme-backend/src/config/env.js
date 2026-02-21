import dotenv from 'dotenv';

dotenv.config();

function parseIceServers(raw) {
  if (!raw) {
    return [{ urls: ['stun:stun.l.google.com:19302'] }];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [{ urls: ['stun:stun.l.google.com:19302'] }];
  } catch {
    return [{ urls: ['stun:stun.l.google.com:19302'] }];
  }
}

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CREATOR_SHARE_PERCENT: Number(process.env.CREATOR_SHARE_PERCENT || 40),
  ADMIN_EMAILS: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  ICE_SERVERS: parseIceServers(process.env.ICE_SERVERS_JSON),
  SOCKET_ALLOWED_ORIGIN: process.env.SOCKET_ALLOWED_ORIGIN || '*',
  REDIS_URL: process.env.REDIS_URL || '',
};
