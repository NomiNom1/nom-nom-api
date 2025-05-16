import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { LocationController } from "../controllers/location.controller";

const router = Router();
const locationController = new LocationController();

// Rate limiting configuration
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const detailsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Location routes
router.get("/search", searchLimiter, locationController.searchAddress);
router.get("/details", detailsLimiter, locationController.getPlaceDetails);

export default router;
