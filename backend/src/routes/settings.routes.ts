import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  getSystemSettings,
  getSystemSettingByKey,
  updateSystemSetting,
  getEmailTemplates,
  updateEmailTemplate,
  testEmailTemplate
} from '../controllers/settings.controller';

const router = Router();

// All settings routes require Admin role
router.use(requireAuth);
router.use(requireRole(['Admin']));

// Settings
router.get('/', getSystemSettings);
router.get('/:key', getSystemSettingByKey);
router.put('/:key', updateSystemSetting);

// Email Templates
router.get('/email-templates/all', getEmailTemplates);
router.put('/email-templates/:id', updateEmailTemplate);
router.post('/email-templates/test', testEmailTemplate);

export default router;
