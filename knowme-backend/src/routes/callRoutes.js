import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createCall, endCall, getIceConfig, getMyCallHistory } from '../controllers/callController.js';

const router = Router();

router.get('/ice-config', requireAuth, getIceConfig);
router.get('/history', requireAuth, getMyCallHistory);
router.post('/', requireAuth, createCall);
router.post('/:callId/end', requireAuth, endCall);

export default router;
