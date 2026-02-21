import { Router } from 'express';
import { createAd, getRevenueSummary, trackAdImpression } from '../controllers/adController.js';
import { attachUserIfPresent, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, createAd);
router.post('/impressions', attachUserIfPresent, trackAdImpression);
router.get('/revenue/:userId', requireAuth, getRevenueSummary);

export default router;
