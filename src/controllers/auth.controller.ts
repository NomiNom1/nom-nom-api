import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { logger } from '../utils/logger';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  initiateEmailAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ message: 'Email is required' });
        return;
      }

      await this.authService.initiateEmailAuth(email);
      res.status(200).json({ message: 'Authentication email sent' });
    } catch (error) {
      logger.error('Error in initiateEmailAuth controller:', error);
      res.status(500).json({ message: 'Error initiating email auth', error: (error as Error).message });
    }
  };

  verifyEmailToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.query;
      const deviceInfo = {
        deviceId: req.headers['x-device-id'] as string,
        platform: req.headers['x-platform'] as string,
        os: req.headers['x-os'] as string,
        appVersion: req.headers['x-app-version'] as string,
      };

      if (!token || !deviceInfo.deviceId) {
        res.status(400).json({ message: 'Token and device information are required' });
        return;
      }

      // const tokens = await this.authService.verifyEmailToken(token as string, deviceInfo);
      res.status(200).json("tokens");
    } catch (error) {
      logger.error('Error in verifyEmailToken controller:', error);
      res.status(500).json({ message: 'Error verifying email token', error: (error as Error).message });
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ message: 'Refresh token is required' });
        return;
      }

      const tokens = await this.authService.refreshAccessToken(refreshToken);
      res.status(200).json(tokens);
    } catch (error) {
      logger.error('Error in refreshToken controller:', error);
      res.status(500).json({ message: 'Error refreshing token', error: (error as Error).message });
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ message: 'Refresh token is required' });
        return;
      }

      await this.authService.invalidateSession(refreshToken);
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Error in logout controller:', error);
      res.status(500).json({ message: 'Error logging out', error: (error as Error).message });
    }
  };

  logoutAllDevices = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id; // This will be set by auth middleware
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      await this.authService.invalidateAllUserSessions(userId);
      res.status(200).json({ message: 'Logged out from all devices' });
    } catch (error) {
      logger.error('Error in logoutAllDevices controller:', error);
      res.status(500).json({ message: 'Error logging out from all devices', error: (error as Error).message });
    }
  };
} 