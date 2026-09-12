import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import * as RoutingController from '../controllers/routing.controller';

const router = Router();

// Only Admin can configure routing
router.use(requireAuth, requireRole(['Admin']));

// Technician Unit Assignments
router.get('/assignments', RoutingController.getUnitAssignments);
router.post('/assignments', RoutingController.createUnitAssignment);
router.delete('/assignments/:id', RoutingController.deleteUnitAssignment);

// Ticket Routing Rules
router.get('/rules', RoutingController.getRoutingRules);
router.post('/rules', RoutingController.createRoutingRule);
router.put('/rules/:id', RoutingController.updateRoutingRule);
router.delete('/rules/:id', RoutingController.deleteRoutingRule);

export default router;
