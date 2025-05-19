import { Router } from 'express';
import { AddressController } from '../controllers/address.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();
const addressController = new AddressController();

// Rate limiting configuration
const addressLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many address requests, please try again later.',
  keyGenerator: (req) => `ratelimit:address:${req.user?.id || req.ip}`,
});

// All routes require authentication
router.use(authenticateToken);

// Address routes with rate limiting
router.post('/', addressLimiter, addressController.addAddress);
router.post('/from-places', addressLimiter, addressController.addAddressFromPlaces);
router.get('/', addressLimiter, addressController.getAddresses);
router.get('/:addressId', addressLimiter, addressController.getAddressById);
router.put('/:addressId', addressLimiter, addressController.updateAddress);
router.delete('/:addressId', addressLimiter, addressController.deleteAddress);
router.post('/:addressId/default', addressLimiter, addressController.setDefaultAddress);

export default router; 