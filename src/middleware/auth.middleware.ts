import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check for API Gateway authentication
    const apiGatewayUserId = req.headers['x-user-id'] as string;
    const apiGatewayToken = req.headers['x-api-key'] as string;

    // Check for API layer authentication
    const authHeader = req.headers['authorization'];
    const apiToken = authHeader && authHeader.split(' ')[1];

    if (!apiGatewayUserId || !apiGatewayToken) {
      res.status(401).json({ message: 'API Gateway authentication required' });
      return;
    }

    // Verify API Gateway token
    if (apiGatewayToken !== process.env.API_GATEWAY_KEY) {
      res.status(401).json({ message: 'Invalid API Gateway token' });
      return;
    }

    // If API token is provided, verify it as well
    if (apiToken) {
      try {
        const decoded = jwt.verify(apiToken, JWT_SECRET) as { userId: string };
        
        // Verify that the API Gateway userId matches the token userId
        if (decoded.userId !== apiGatewayUserId) {
          res.status(401).json({ message: 'User ID mismatch' });
          return;
        }

        const user = await User.findById(decoded.userId);
        if (!user) {
          res.status(401).json({ message: 'User not found' });
          return;
        }

        req.user = {
          id: user.id.toString(),
          email: user.email,
        };
      } catch (error) {
        logger.error('Error verifying API token:', error);
        res.status(401).json({ message: 'Invalid API token' });
        return;
      }
    } else {
      // If no API token, just verify the user exists
      const user = await User.findById(apiGatewayUserId);
      if (!user) {
        res.status(401).json({ message: 'User not found' });
        return;
      }

      req.user = {
        id: user.id.toString(),
        email: user.email,
      };
    }

    next();
  } catch (error) {
    logger.error('Error in authenticateToken middleware:', error);
    res.status(401).json({ message: 'Authentication failed' });
  }
}; 