import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { 
  getAssets, createAsset, getAssetById, updateAsset, getCategories, assignAsset, bulkImportAssets, updateAssetWarranty
} from '../controllers/assets.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getAssets);
router.get('/categories', getCategories);
router.post('/', requireRole(['Admin', 'Technician']), createAsset);
router.post('/bulk-import', requireRole(['Admin', 'Technician']), bulkImportAssets);
router.get('/:id', getAssetById);
router.patch('/:id', requireRole(['Admin', 'Technician']), updateAsset);
router.put('/:id', requireRole(['Admin', 'Technician']), updateAsset);
router.post('/:id/assign', requireRole(['Admin', 'Technician']), assignAsset);
router.put('/:id/warranty', requireRole(['Admin', 'Technician']), updateAssetWarranty);
router.post('/:id/warranty', requireRole(['Admin', 'Technician']), updateAssetWarranty);

export default router;
