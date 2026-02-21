import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createComment, listComments } from '../controllers/commentController.js';

const router = Router({ mergeParams: true });

router.get('/', listComments);
router.post('/', requireAuth, createComment);

export default router;
