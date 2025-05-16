import Redis from 'ioredis';
import { logger } from '../utils/logger';

export class RedisService {
  private readonly redis: Redis;
  private static instance: RedisService;

  private constructor() {
    // Configure Redis cluster connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('Successfully connected to Redis');
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis get error:', error);
      throw error;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, stringValue);
      } else {
        await this.redis.set(key, stringValue);
      }
    } catch (error) {
      logger.error('Redis set error:', error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Redis delete error:', error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error:', error);
      throw error;
    }
  }

  // For rate limiting
  async increment(key: string, ttlSeconds: number): Promise<number> {
    try {
      const multi = this.redis.multi();
      multi.incr(key);
      multi.expire(key, ttlSeconds);
      const results = await multi.exec();
      return results ? (results[0][1] as number) : 0;
    } catch (error) {
      logger.error('Redis increment error:', error);
      throw error;
    }
  }

  // For distributed locking
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.redis.set(
        `lock:${key}`,
        '1',
        'EX',
        ttlSeconds
      );
      return result === 'OK';
    } catch (error) {
      logger.error('Redis acquire lock error:', error);
      throw error;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      await this.redis.del(`lock:${key}`);
    } catch (error) {
      logger.error('Redis release lock error:', error);
      throw error;
    }
  }
} 