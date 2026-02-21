import { prisma } from '../config/prisma.js';

function extractFacts(text) {
  const facts = [];
  const clean = text.trim();
  const nameMatch = clean.match(/(?:me llamo|my name is)\s+([a-záéíóúñ0-9_ -]+)/i);
  if (nameMatch) facts.push({ key: 'name', value: nameMatch[1].trim(), confidence: 0.95 });

  const prefMatch = clean.match(/(?:prefiero|i prefer)\s+([a-záéíóúñ0-9_ ,.-]+)/i);
  if (prefMatch) facts.push({ key: 'preference', value: prefMatch[1].trim(), confidence: 0.8 });

  const goalMatch = clean.match(/(?:objetivo|goal)\s*[:=-]?\s*([a-záéíóúñ0-9_ ,.-]+)/i);
  if (goalMatch) facts.push({ key: 'goal', value: goalMatch[1].trim(), confidence: 0.85 });

  return facts;
}

function buildResponse(input, memories) {
  const lower = input.toLowerCase();
  const lookup = Object.fromEntries(memories.map((entry) => [entry.key, entry.value]));

  if (lower.includes('llamada') || lower.includes('call')) {
    return 'Puedo ayudarte a gestionar llamadas: abre un chat directo, inicia audio/video y yo te guío paso a paso.';
  }
  if (lower.includes('mensaje') || lower.includes('message')) {
    return 'Para mensajería segura: abre chat, verifica llave E2EE y envía texto/voz. También puedes usar reacciones, leído y borrar para todos.';
  }
  if (lookup.name) {
    return `Te recuerdo ${lookup.name}. ¿Continuamos con ${lookup.goal || 'tu flujo principal'}?`;
  }

  return 'Memoria activa. Cuéntame un dato clave (ej. "me llamo...", "objetivo: ...") y lo guardaré para asistirte en chats y llamadas.';
}

export async function processAssistantMessage(userId, input) {
  const text = String(input || '').trim();
  if (!text) throw new Error('input requerido');

  await prisma.assistantMessage.create({ data: { userId, role: 'USER', content: text } });

  const facts = extractFacts(text);
  if (facts.length) {
    await Promise.all(facts.map((fact) => prisma.assistantMemory.upsert({
      where: { userId_key: { userId, key: fact.key } },
      update: { value: fact.value, confidence: fact.confidence },
      create: { userId, key: fact.key, value: fact.value, confidence: fact.confidence },
    })));
  }

  const memories = await prisma.assistantMemory.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 10 });
  const reply = buildResponse(text, memories);

  await prisma.assistantMessage.create({ data: { userId, role: 'ASSISTANT', content: reply } });

  return { reply, memories };
}

export async function getAssistantContext(userId) {
  const [memories, messages] = await Promise.all([
    prisma.assistantMemory.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 20 }),
    prisma.assistantMessage.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  return { memories, messages: messages.reverse() };
}
