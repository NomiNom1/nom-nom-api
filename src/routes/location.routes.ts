import { Router } from "express";
import { LocationController } from "../controllers/location.controller";
import { createRateLimiter } from "../middleware/rate-limit.middleware";

const router = Router();
const locationController = new LocationController();

// Rate limiting configuration
const searchLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: "Too many search requests, please try again later.",
  keyGenerator: (req) => `ratelimit:search:${req.ip}`,
});

const detailsLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: "Too many details requests, please try again later.",
  keyGenerator: (req) => `ratelimit:details:${req.ip}`,
});

// Location routes
router.get("/search", searchLimiter, locationController.searchAddress);
router.get("/details", detailsLimiter, locationController.getPlaceDetails);

export default router;
