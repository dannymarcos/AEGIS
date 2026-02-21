import { Router } from 'express';
import {
  getCreatorDashboardById,
  getMonetizationConfig,
  getMyCreatorDashboard,
  registerRevenueEvent,
  updateCreatorShareConfig,
} from '../controllers/monetizationController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/config', requireAuth, getMonetizationConfig);
router.put('/config', requireAuth, requireAdmin, updateCreatorShareConfig);
router.get('/dashboard/me', requireAuth, getMyCreatorDashboard);
router.get('/dashboard/:userId', requireAuth, requireAdmin, getCreatorDashboardById);
router.post('/revenue/events', requireAuth, requireAdmin, registerRevenueEvent);

export default router;
