import { Router } from 'express';
import {
  createModerationReport,
  getAnalytics,
  getModerationQueue,
  getRevenueTracking,
  getUsers,
  moderateUser,
  updateUserRole,
} from '../controllers/adminController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/moderation/reports', requireAuth, createModerationReport);
router.get('/analytics', requireAuth, requireAdmin, getAnalytics);
router.get('/moderation/queue', requireAuth, requireAdmin, getModerationQueue);
router.patch('/users/:userId/suspend', requireAuth, requireAdmin, moderateUser);
router.patch('/users/:userId/role', requireAuth, requireAdmin, updateUserRole);
router.get('/users', requireAuth, requireAdmin, getUsers);
router.get('/revenue/tracking', requireAuth, requireAdmin, getRevenueTracking);

export default router;
