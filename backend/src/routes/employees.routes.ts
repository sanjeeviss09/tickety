import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import { 
  getEmployees, 
  getEmployeeById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee,
  bulkImportEmployees,
  resetEmployeePassword,
} from '../controllers/employees.controller';
import { getRoles } from '../controllers/users.controller';

const router = Router();

router.use(requireAuth);

router.get('/', getEmployees);
router.get('/roles', getRoles);
router.get('/:id', getEmployeeById);

// Admin and Technician routes
router.post('/', requireRole(['Admin', 'Technician']), createEmployee);
router.put('/:id', requireRole(['Admin', 'Technician']), updateEmployee);
router.post('/:id/reset-password', requireRole(['Admin']), resetEmployeePassword);
router.delete('/:id', requireRole(['Admin', 'Technician']), deleteEmployee);
router.post('/bulk-import', requireRole(['Admin', 'Technician']), bulkImportEmployees);

export default router;
