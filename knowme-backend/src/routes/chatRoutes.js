import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  addReaction,
  createGroupChat,
  createOrGetDirectChat,
  deleteForEveryone,
  getChatMessages,
  listMyChats,
  markChatRead,
  removeReaction,
} from '../controllers/chatController.js';

const router = Router();

router.get('/', requireAuth, listMyChats);
router.post('/direct', requireAuth, createOrGetDirectChat);
router.post('/group', requireAuth, createGroupChat);
router.get('/:chatId/messages', requireAuth, getChatMessages);
router.post('/:chatId/read', requireAuth, markChatRead);
router.post('/messages/:messageId/reactions', requireAuth, addReaction);
router.delete('/messages/:messageId/reactions', requireAuth, removeReaction);
router.post('/messages/:messageId/delete-for-everyone', requireAuth, deleteForEveryone);

export default router;
