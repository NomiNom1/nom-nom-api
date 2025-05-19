import { RedisConfig } from '../services/redis.service';

export interface RedisInstanceConfig {
  name: string;
  config: RedisConfig;
}

export const REDIS_INSTANCES: RedisInstanceConfig[] = [
  {
    name: 'default',
    config: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'default',
    },
  },
  {
    name: 'rate_limiter',
    config: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'rate_limiter',
    },
  },
  {
    name: 'location_service',
    config: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'location_service',
    },
  },
  {
    name: 'phone_verification',
    config: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0,
      keyPrefix: 'phone_verification',
    },
  },
];

export const getRedisConfig = (instanceName: string): RedisConfig => {
  const instance = REDIS_INSTANCES.find(inst => inst.name === instanceName);
  if (!instance) {
    throw new Error(`Redis instance '${instanceName}' not found`);
  }
  return instance.config;
}; 