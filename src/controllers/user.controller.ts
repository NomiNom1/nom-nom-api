import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { logger } from '../utils/logger';

export class UserController {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userService.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      logger.error('Error in createUser controller:', error);
      res.status(500).json({ message: 'Error creating user', error: (error as Error).message });
    }
  };

  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      logger.error('Error in getUserById controller:', error);
      res.status(500).json({ message: 'Error fetching user', error: (error as Error).message });
    }
  };

  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userService.updateUser(req.params.id, req.body);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      logger.error('Error in updateUser controller:', error);
      res.status(500).json({ message: 'Error updating user', error: (error as Error).message });
    }
  };

  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await this.userService.deleteUser(req.params.id);
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      res.status(204).send();
    } catch (error) {
      logger.error('Error in deleteUser controller:', error);
      res.status(500).json({ message: 'Error deleting user', error: (error as Error).message });
    }
  };

  listUsers = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.userService.listUsers(page, limit);
      res.json(result);
    } catch (error) {
      logger.error('Error in listUsers controller:', error);
      res.status(500).json({ message: 'Error listing users', error: (error as Error).message });
    }
  };

  findUserByPhone = async (req: Request, res: Response): Promise<void> => {
    try {
      const { phone, countryCode } = req.query;
      
      if (!phone || !countryCode) {
        res.status(400).json({ message: 'Phone number and country code are required' });
        return;
      }

      const user = await this.userService.findUserByPhone(phone as string, countryCode as string);
      
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }

      res.json(user);
    } catch (error) {
      logger.error('Error in findUserByPhone controller:', error);
      res.status(500).json({ message: 'Error finding user', error: (error as Error).message });
    }
  };
} 