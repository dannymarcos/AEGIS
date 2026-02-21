import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { cleanupStoriesNow, createStory, listActiveStories, toggleStoryLike } from '../controllers/socialStoryController.js';

const router = Router();

router.post('/', requireAuth, createStory);
router.get('/', requireAuth, listActiveStories);
router.post('/:storyId/likes', requireAuth, toggleStoryLike);
router.post('/cleanup', cleanupStoriesNow);

export default router;
