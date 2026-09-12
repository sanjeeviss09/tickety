import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getRoles
} from '../controllers/users.controller';

const router = Router();

// Only Admins can manage users
router.use(requireAuth);
router.use(requireRole(['Admin']));

router.get('/', getUsers);
router.get('/roles', getRoles);
router.post('/', createUser);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
