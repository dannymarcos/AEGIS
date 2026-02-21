import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { acceptFriend, requestFriend, toggleFollow } from '../controllers/socialGraphController.js';

const router = Router();

router.post('/follow/:userId', requireAuth, toggleFollow);
router.post('/friends/request/:userId', requireAuth, requestFriend);
router.post('/friends/accept/:userId', requireAuth, acceptFriend);

export default router;
