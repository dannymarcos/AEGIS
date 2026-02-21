import { Router } from 'express';
import { attachUserIfPresent, requireAuth } from '../middleware/auth.js';
import { addView, createVideo, getVideo, listVideos, toggleLike } from '../controllers/videoController.js';

const router = Router();

router.get('/', attachUserIfPresent, listVideos);
router.get('/:id', getVideo);
router.post('/', requireAuth, createVideo);
router.post('/:id/views', addView);
router.post('/:id/likes', requireAuth, toggleLike);

export default router;
