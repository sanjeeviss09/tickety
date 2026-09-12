import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  getSummary, getTicketTrends, getTicketDistribution,
  getAssetDistribution, getTechnicianPerformance, getDepartmentStats, getKpis,
  getTechnicianDashboard
} from '../controllers/analytics.controller';

const router = Router();
router.use(requireAuth);
router.use(requireRole(['Admin', 'Technician']));

router.get('/summary', getSummary);
router.get('/ticket-trends', getTicketTrends);
router.get('/ticket-distribution', getTicketDistribution);
router.get('/asset-distribution', getAssetDistribution);
router.get('/technician-performance', getTechnicianPerformance);
router.get('/department-stats', getDepartmentStats);
router.get('/kpis', getKpis);
router.get('/technician-dashboard', getTechnicianDashboard);

export default router;
