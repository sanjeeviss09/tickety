import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { checkIn, checkOut } from '../controllers/attendance.controller';

const router = Router();

router.use(requireAuth);

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);

export default router;
