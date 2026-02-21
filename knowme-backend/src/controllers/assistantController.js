import { getAssistantContext, processAssistantMessage } from '../services/assistantService.js';

export async function sendAssistantMessage(req, res) {
  const result = await processAssistantMessage(req.user.userId, req.body.message);
  return res.status(201).json(result);
}

export async function getAssistantMemory(req, res) {
  const context = await getAssistantContext(req.user.userId);
  return res.json(context);
}
