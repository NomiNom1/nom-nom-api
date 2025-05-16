import Redis from "ioredis";
import { logger } from "../utils/logger";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export class RedisService {
  private static instances: Map<string, RedisService> = new Map();
  private readonly redis: Redis;
  private readonly config: RedisConfig;
  private readonly metrics = {
    commands: 0,
    errors: 0,
    latency: 0,
  };

  private constructor(config: RedisConfig) {
    this.config = config;

    // Configure Redis connection with connection pooling
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      enableReadyCheck: true,
      showFriendlyErrorStack: process.env.NODE_ENV !== "production",
      // Connection pooling settings
      connectionName: config.keyPrefix || "default",
      enableOfflineQueue: true,
      maxRetriesPerRequest: 3,
      reconnectOnError: (err) => {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.redis.on("error", (error) => {
      this.metrics.errors++;
      logger.error("Redis connection error:", error);
    });

    this.redis.on("connect", () => {
      logger.info(
        `Successfully connected to Redis instance: ${this.config.keyPrefix || "default"}`
      );
    });

    this.redis.on("ready", () => {
      logger.info(
        `Redis instance ready: ${this.config.keyPrefix || "default"}`
      );
    });
  }

  public static getInstance(config: RedisConfig): RedisService {
    const key = `${config.host}:${config.port}:${config.db || 0}:${config.keyPrefix || "default"}`;
    if (!RedisService.instances.has(key)) {
      RedisService.instances.set(key, new RedisService(config));
    }
    return RedisService.instances.get(key)!;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const startTime = Date.now();
      const data = await this.redis.get(key);
      this.metrics.latency += Date.now() - startTime;
      this.metrics.commands++;
      return data ? JSON.parse(data) : null;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis get error:", error);
      throw error;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const startTime = Date.now();
      const stringValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, stringValue);
      } else {
        await this.redis.set(key, stringValue);
      }
      this.metrics.latency += Date.now() - startTime;
      this.metrics.commands++;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis set error:", error);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      const startTime = Date.now();
      await this.redis.del(key);
      this.metrics.latency += Date.now() - startTime;
      this.metrics.commands++;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis delete error:", error);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const startTime = Date.now();
      const result = await this.redis.exists(key);
      this.metrics.latency += Date.now() - startTime;
      this.metrics.commands++;
      return result === 1;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis exists error:", error);
      throw error;
    }
  }

  // For rate limiting
  async increment(key: string, ttlSeconds: number): Promise<number> {
    try {
      const startTime = Date.now();
      const multi = this.redis.multi();
      multi.incr(key);
      multi.expire(key, ttlSeconds);
      const results = await multi.exec();
      this.metrics.latency += Date.now() - startTime;
      this.metrics.commands++;
      return results ? (results[0][1] as number) : 0;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis increment error:", error);
      throw error;
    }
  }

  // For distributed locking
  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const startTime = Date.now();
      const result = await this.redis.set(
        `lock:${key}`,
        "1",
        "EX",
        ttlSeconds,
        "NX"
      );
      this.metrics.latency += Date.now() - startTime;
      this.metrics.commands++;
      return result === "OK";
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis acquire lock error:", error);
      throw error;
    }
  }

  async releaseLock(key: string): Promise<void> {
    try {
      const startTime = Date.now();
      await this.redis.del(`lock:${key}`);
      this.metrics.latency += Date.now() - startTime;
      this.metrics.commands++;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis release lock error:", error);
      throw error;
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.redis.ping();
      this.metrics.latency += Date.now() - startTime;
      this.metrics.commands++;
      return true;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Redis health check failed:", error);
      return false;
    }
  }

  // Get metrics
  getMetrics() {
    return { ...this.metrics };
  }

  // Reset metrics
  resetMetrics() {
    Object.keys(this.metrics).forEach((key) => {
      this.metrics[key as keyof typeof this.metrics] = 0;
    });
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}
