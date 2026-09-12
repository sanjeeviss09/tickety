import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { getUnits, createUnit, updateUnit, deleteUnit } from '../controllers/units.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getUnits);
router.post('/', requireRole(['Admin']), createUnit);
router.put('/:id', requireRole(['Admin']), updateUnit);
router.delete('/:id', requireRole(['Admin']), deleteUnit);

export default router;
