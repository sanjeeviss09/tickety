import { Router } from 'express';
import { firstLogin } from '../controllers/auth.controller';

const router = Router();

// Public route for first time login (password setup)
router.post('/first-login', firstLogin);

export default router;
