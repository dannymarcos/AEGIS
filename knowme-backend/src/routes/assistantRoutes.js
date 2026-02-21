import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAssistantMemory, sendAssistantMessage } from '../controllers/assistantController.js';

const router = Router();

router.get('/memory', requireAuth, getAssistantMemory);
router.post('/message', requireAuth, sendAssistantMessage);

export default router;
