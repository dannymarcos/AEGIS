import { env } from '../config/env.js';
import { createCallLog, getCallForUser, listCallHistory, updateCallStatus } from '../services/callService.js';

export async function getIceConfig(_req, res) {
  return res.json({ iceServers: env.ICE_SERVERS });
}

export async function createCall(req, res) {
  const { receiverId, callType, chatId = null } = req.body;
  if (!receiverId || !callType) return res.status(400).json({ message: 'receiverId y callType requeridos' });
  if (!['AUDIO', 'VIDEO'].includes(callType)) return res.status(400).json({ message: 'callType inválido' });
  if (receiverId === req.user.userId) return res.status(400).json({ message: 'No puedes llamarte a ti mismo' });

  const call = await createCallLog({
    callType,
    initiatorId: req.user.userId,
    receiverId,
    chatId,
  });

  return res.status(201).json(call);
}

export async function getMyCallHistory(req, res) {
  const rows = await listCallHistory(req.user.userId, Number(req.query.limit || 100));
  return res.json(rows);
}

export async function endCall(req, res) {
  const call = await getCallForUser(req.params.callId, req.user.userId);
  if (!call) return res.status(404).json({ message: 'Call no encontrada' });
  if (['ENDED', 'REJECTED', 'MISSED', 'FAILED'].includes(call.status)) return res.json(call);

  const ended = await updateCallStatus(call.id, 'ENDED', {
    endedAt: new Date(),
    endReason: req.body?.endReason || 'MANUAL',
  });

  return res.json(ended);
}
