import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/email', authController.initiateEmailAuth);
router.get('/verify', authController.verifyEmailToken);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

// Protected routes
router.post('/logout-all', authenticateToken, authController.logoutAllDevices);

export default router; 