import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthSession, IAuthSession } from '../models/auth.model';
import { User, IUser } from '../models/user.model';
import { logger } from '../utils/logger';
import { sendEmail } from '../utils/email';

const JWT_SECRET = process.env.JWT_SECRET ?? 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'your-refresh-secret-key';
const EMAIL_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export class AuthService {
  private generateEmailToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  private generateAccessToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
  }

  async initiateEmailAuth(email: string): Promise<void> {
    try {
      const emailToken = this.generateEmailToken();
      const user = await User.findOne({ email });
      
      if (!user) {
        // Create new user if doesn't exist
        const newUser = new User({ email });
        await newUser.save();
      }

      // Store email token in Redis with 15-minute expiry
      // TODO: Implement Redis storage for email tokens
      
      // Send email with magic link
      const magicLink = `${process.env.APP_URL}/auth/verify?token=${emailToken}`;
      await sendEmail({
        to: email,
        subject: 'Sign in to Nom Nom',
        text: `Click here to sign in: ${magicLink}`,
        html: `<a href="${magicLink}">Click here to sign in</a>`,
      });
    } catch (error) {
      logger.error('Error in initiateEmailAuth:', error);
      throw error;
    }
  }

  async verifyEmailToken(token: string, deviceInfo: any): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // TODO: Verify token from Redis
      const emailToken = token; // Get from Redis
      
      // Find or create user
      const user = await User.findOne({ email: emailToken });
      if (!user) {
        throw new Error('Invalid token');
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(user.id.toString());
      const refreshToken = this.generateRefreshToken();

      // Create session
      const session = new AuthSession({
        userId: user._id,
        refreshToken,
        deviceId: deviceInfo.deviceId,
        deviceInfo: {
          platform: deviceInfo.platform,
          os: deviceInfo.os,
          appVersion: deviceInfo.appVersion,
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      await session.save();

      return { accessToken, refreshToken };
    } catch (error) {
      logger.error('Error in verifyEmailToken:', error);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const session = await AuthSession.findOne({ refreshToken, isValid: true });
      if (!session) {
        throw new Error('Invalid refresh token');
      }

      if (session.expiresAt < new Date()) {
        session.isValid = false;
        await session.save();
        throw new Error('Refresh token expired');
      }

      // Generate new tokens
      const accessToken = this.generateAccessToken(session.userId.toString());
      const newRefreshToken = this.generateRefreshToken();

      // Update session
      session.refreshToken = newRefreshToken;
      session.lastActive = new Date();
      session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await session.save();

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      logger.error('Error in refreshAccessToken:', error);
      throw error;
    }
  }

  async invalidateSession(refreshToken: string): Promise<void> {
    try {
      const session = await AuthSession.findOne({ refreshToken });
      if (session) {
        session.isValid = false;
        await session.save();
      }
    } catch (error) {
      logger.error('Error in invalidateSession:', error);
      throw error;
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      await AuthSession.updateMany(
        { userId, isValid: true },
        { $set: { isValid: false } }
      );
    } catch (error) {
      logger.error('Error in invalidateAllUserSessions:', error);
      throw error;
    }
  }
} 