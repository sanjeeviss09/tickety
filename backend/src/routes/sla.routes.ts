import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  getSlaPolicies,
  createSlaPolicy,
  updateSlaPolicy,
  deleteSlaPolicy,
  getBusinessHours
} from '../controllers/sla.controller';

const router = Router();

router.use(requireAuth);
// Most endpoints require Admin role
router.get('/policies', getSlaPolicies);
router.post('/policies', requireRole(['Admin']), createSlaPolicy);
router.put('/policies/:id', requireRole(['Admin']), updateSlaPolicy);
router.delete('/policies/:id', requireRole(['Admin']), deleteSlaPolicy);

router.get('/business-hours', getBusinessHours);

export default router;
