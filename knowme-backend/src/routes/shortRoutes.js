import { Router } from 'express';
import { attachUserIfPresent, requireAuth } from '../middleware/auth.js';
import { createShort, getShortFeed, refreshShortTrending, trackShortWatch } from '../controllers/shortController.js';

const router = Router();

router.get('/feed', attachUserIfPresent, getShortFeed);
router.post('/', requireAuth, createShort);
router.post('/:shortId/watch', attachUserIfPresent, trackShortWatch);
router.post('/trending/refresh', refreshShortTrending);

export default router;
