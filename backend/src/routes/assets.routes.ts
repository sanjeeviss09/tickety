import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { 
  getAssets, createAsset, getAssetById, updateAsset, getCategories, assignAsset, bulkImportAssets
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

export default router;
