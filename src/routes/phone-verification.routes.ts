import { Router } from 'express';
import { PhoneVerificationController } from '../controllers/phone-verification.controller';

const router = Router();
const phoneVerificationController = new PhoneVerificationController();

// Phone verification routes
router.post('/send-verification', phoneVerificationController.sendVerificationCode);
router.post('/verify-code', phoneVerificationController.verifyCode);

export default router; 