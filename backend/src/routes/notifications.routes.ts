import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from '../controllers/notifications.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/mark-all-read', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
