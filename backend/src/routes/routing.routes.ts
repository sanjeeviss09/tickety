import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import * as RoutingController from '../controllers/routing.controller';

const router = Router();

// Admin and Tech can view routing info
router.get('/assignments', requireAuth, requireRole(['Admin', 'Technician']), RoutingController.getUnitAssignments);
router.get('/rules', requireAuth, requireRole(['Admin', 'Technician']), RoutingController.getRoutingRules);

// Only Admin can configure routing
router.post('/assignments', requireAuth, requireRole(['Admin']), RoutingController.createUnitAssignment);
router.delete('/assignments/:id', requireAuth, requireRole(['Admin']), RoutingController.deleteUnitAssignment);

router.post('/rules', requireAuth, requireRole(['Admin']), RoutingController.createRoutingRule);
router.put('/rules/:id', requireAuth, requireRole(['Admin']), RoutingController.updateRoutingRule);
router.delete('/rules/:id', requireAuth, requireRole(['Admin']), RoutingController.deleteRoutingRule);

export default router;
