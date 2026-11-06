import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  getSummary, getTicketTrends, getTicketDistribution,
  getAssetDistribution, getTechnicianPerformance, getDepartmentStats, getKpis,
  getTechnicianDashboard, getResolutionBreakdown, getIndividualTechnicianPerformance
} from '../controllers/analytics.controller';

const router = Router();
router.use(requireAuth);
router.use(requireRole(['Admin', 'Technician']));

router.get('/summary', getSummary);
router.get('/resolution-breakdown', getResolutionBreakdown);
router.get('/ticket-trends', getTicketTrends);
router.get('/ticket-distribution', getTicketDistribution);
router.get('/asset-distribution', getAssetDistribution);
router.get('/technician-performance', getTechnicianPerformance);
router.get('/technician-performance/:id', getIndividualTechnicianPerformance);
router.get('/department-stats', getDepartmentStats);
router.get('/kpis', getKpis);
router.get('/technician-dashboard', getTechnicianDashboard);



export default router;
