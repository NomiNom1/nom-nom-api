import { RateLimiterRedis } from "rate-limiter-flexible";
import { Twilio } from "twilio";
import { getRedisConfig } from "../config/redis.config";
import { logger } from "../utils/logger";
import { RedisService } from "./redis.service";

export class PhoneVerificationService {
  private readonly twilioClient: Twilio;
  private readonly redisService: RedisService;
  private readonly rateLimiter: RateLimiterRedis;

  constructor() {
    // Initialize Twilio client
    this.twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    this.redisService = RedisService.getInstance(
      getRedisConfig("phone_verification")
    );

    // Initialize rate limiter using the Redis service
    this.rateLimiter = new RateLimiterRedis({
      storeClient: this.redisService["redis"],
      keyPrefix: "phone_verification",
      points: 3, // Number of attempts
      duration: 60 * 15, // 15 minutes
      blockDuration: 60 * 60, // 1 hour block if exceeded
    });
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendVerificationCode(phoneNumber: string): Promise<void> {
    try {
      // Check rate limit
      await this.rateLimiter.consume(phoneNumber);

      // Generate verification code
      const code = this.generateVerificationCode();

      // Store code in Redis with 10-minute expiry
      await this.redisService.set(`verification:${phoneNumber}`, code, 600);

      // Send SMS via Twilio
      const res = await this.twilioClient.messages.create({
        body: `Your NomiNom verification code is: ${code}`,
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
      });
      logger.info(`SMS sent: ${JSON.stringify(res)}`);
      logger.info(`Verification code ${code} sent to ${phoneNumber}`);
    } catch (error: any) {
      if (error.name === "RateLimiterError") {
        logger.warn(`Rate limit exceeded for ${phoneNumber}`);
        throw new Error("Too many attempts. Please try again later.");
      }
      logger.error("Error sending verification code:", error);
      throw new Error("Failed to send verification code");
    }
  }

  async verifyCode(phoneNumber: string, code: string): Promise<boolean> {
    try {
      // Get stored code from Redis
      const storedCode = await this.redisService.get<string>(
        `verification:${phoneNumber}`
      );

      if (!storedCode || storedCode !== code) {
        logger.warn(`Invalid verification code for ${phoneNumber}`);
        return false;
      }

      // Clear the code from Redis
      await this.redisService.del(`verification:${phoneNumber}`);
      logger.info(`Phone number ${phoneNumber} verified successfully`);
      return true;
    } catch (error) {
      logger.error("Error verifying code:", error);
      throw new Error("Failed to verify code");
    }
  }

  async cleanup(): Promise<void> {
    // No need to cleanup Redis connection as it's managed by RedisService
  }
}
