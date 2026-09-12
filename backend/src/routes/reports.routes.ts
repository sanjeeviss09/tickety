import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  getTicketSummaryReport, getTechnicianReport, getAssetInventoryReport,
  getSlaComplianceReport, getWarrantyReport,
  getTemplates, createTemplate,
  getScheduledReports, createScheduledReport, updateScheduledReport, deleteScheduledReport,
  getDashboardPreferences, saveDashboardPreferences
} from '../controllers/reports.controller';

const router = Router();
router.use(requireAuth);

// Report data endpoints (Admin + Technician)
router.get('/ticket-summary', requireRole(['Admin', 'Technician']), getTicketSummaryReport);
router.get('/technician-performance', requireRole(['Admin', 'Technician']), getTechnicianReport);
router.get('/asset-inventory', requireRole(['Admin', 'Technician']), getAssetInventoryReport);
router.get('/sla-compliance', requireRole(['Admin', 'Technician']), getSlaComplianceReport);
router.get('/warranty', requireRole(['Admin', 'Technician']), getWarrantyReport);

// Templates
router.get('/templates', getTemplates);
router.post('/templates', requireRole(['Admin']), createTemplate);

// Scheduled reports (Admin-only)
router.get('/scheduled', requireRole(['Admin']), getScheduledReports);
router.post('/scheduled', requireRole(['Admin']), createScheduledReport);
router.put('/scheduled/:id', requireRole(['Admin']), updateScheduledReport);
router.delete('/scheduled/:id', requireRole(['Admin']), deleteScheduledReport);

// Dashboard preferences (all authenticated users)
router.get('/preferences/dashboard', getDashboardPreferences);
router.put('/preferences/dashboard', saveDashboardPreferences);

export default router;
