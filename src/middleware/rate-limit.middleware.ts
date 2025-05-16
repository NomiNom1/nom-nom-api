import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis.service';
import { logger } from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

export const createRateLimiter = (config: RateLimitConfig) => {
  const redisService = RedisService.getInstance();
  const windowMs = config.windowMs;
  const max = config.max;
  const message = config.message || 'Too many requests, please try again later.';
  const keyGenerator = config.keyGenerator || ((req: Request) => {
    // Default key generator uses IP address
    return `ratelimit:${req.ip}`;
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = keyGenerator(req);
      const current = await redisService.increment(key, Math.ceil(windowMs / 1000));

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - current));
      res.setHeader('X-RateLimit-Reset', Math.ceil(windowMs / 1000));

      if (current > max) {
        logger.warn(`Rate limit exceeded for ${key}`);
        return res.status(429).json({ message });
      }

      next();
    } catch (error) {
      logger.error('Rate limit error:', error);
      // In case of Redis errors, allow the request to proceed
      next();
    }
  };
}; 