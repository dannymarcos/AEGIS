import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { toggleSubscription } from '../controllers/subscriptionController.js';

const router = Router();

router.post('/:channelId', requireAuth, toggleSubscription);

export default router;
