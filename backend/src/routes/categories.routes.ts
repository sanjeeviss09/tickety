import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { getCategories, createCategory, updateCategory } from '../controllers/categories.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getCategories);
router.post('/', requireRole(['Admin']), createCategory);
router.put('/:id', requireRole(['Admin']), updateCategory);

export default router;
