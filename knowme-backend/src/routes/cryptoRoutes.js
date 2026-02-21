import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMyChatEnvelope, getUserPublicKey, upsertChatKeyEnvelopes, upsertMyPublicKey } from '../controllers/cryptoController.js';

const router = Router();

router.put('/keys/public', requireAuth, upsertMyPublicKey);
router.get('/keys/public/:userId', requireAuth, getUserPublicKey);
router.post('/chats/envelopes', requireAuth, upsertChatKeyEnvelopes);
router.get('/chats/:chatId/envelopes/me', requireAuth, getMyChatEnvelope);

export default router;
