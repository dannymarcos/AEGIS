import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

function signToken(user) {
  return jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export async function register(req, res) {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ message: 'email, username y password son requeridos' });
  }

  const existingUsers = await prisma.user.count();
  const passwordHash = await bcrypt.hash(password, 10);
  const role = existingUsers === 0 || env.ADMIN_EMAILS.includes(email.toLowerCase()) ? 'ADMIN' : 'USER';

  try {
    const user = await prisma.user.create({
      data: { email, username, passwordHash, role },
    });

    return res.status(201).json({ token: signToken(user), user: { id: user.id, email, username, role: user.role } });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ message: 'Email o username ya registrado' });
    }
    throw error;
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Credenciales inválidas' });

  return res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, username: user.username, role: user.role },
  });
}
