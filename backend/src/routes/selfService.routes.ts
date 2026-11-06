import { Router } from 'express';
import { createSelfServiceEvent, updateSelfServiceEvent } from '../controllers/selfService.controller';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

router.post('/events', createSelfServiceEvent);
router.put('/events/:id', updateSelfServiceEvent);

export default router;
