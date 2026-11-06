import { Router } from 'express';
import { firstLogin, checkUserAuthStatus } from '../controllers/auth.controller';

const router = Router();

// Public route for first time login / password reset setup
router.post('/first-login', firstLogin);
router.get('/check-user/:employeeId', checkUserAuthStatus);

export default router;
