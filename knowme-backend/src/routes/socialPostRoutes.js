import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createPost, createPostComment, getPostById, listPostComments, togglePostLike } from '../controllers/socialPostController.js';

const router = Router();

router.post('/', requireAuth, createPost);
router.get('/:postId', requireAuth, getPostById);
router.post('/:postId/likes', requireAuth, togglePostLike);
router.get('/:postId/comments', requireAuth, listPostComments);
router.post('/:postId/comments', requireAuth, createPostComment);

export default router;
