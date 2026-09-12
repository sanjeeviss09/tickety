import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departments.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getDepartments);
router.post('/', requireRole(['Admin']), createDepartment);
router.put('/:id', requireRole(['Admin']), updateDepartment);
router.delete('/:id', requireRole(['Admin']), deleteDepartment);

export default router;
