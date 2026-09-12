import { Router } from 'express';
import { getServiceCatalog, submitServiceRequest, createService, updateService, createFormField, deleteFormField } from '../controllers/services.controller';
import { requireAuth, requireRole } from '../middlewares/auth';

const router = Router();

router.use(requireAuth);

router.get('/', getServiceCatalog);
router.post('/requests', submitServiceRequest);

// Admin Service Management
router.post('/', requireRole(['Admin']), createService);
router.put('/:id', requireRole(['Admin']), updateService);
router.post('/fields', requireRole(['Admin']), createFormField);
router.delete('/fields/:id', requireRole(['Admin']), deleteFormField);

export default router;
