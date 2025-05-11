import { User, IUser } from '../models/user.model';
import { logger } from '../utils/logger';

export class UserService {
  async createUser(userData: Partial<IUser>): Promise<IUser> {
    try {
      const user = new User(userData);
      return await user.save();
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<IUser | null> {
    try {
      return await User.findById(id);
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    try {
      return await User.findOne({ email });
    } catch (error) {
      logger.error('Error fetching user by email:', error);
      throw error;
    }
  }

  async updateUser(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<IUser | null> {
    try {
      return await User.findByIdAndDelete(id);
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  async listUsers(page: number = 1, limit: number = 10): Promise<{ users: IUser[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const [users, total] = await Promise.all([
        User.find().skip(skip).limit(limit),
        User.countDocuments()
      ]);
      return { users, total };
    } catch (error) {
      logger.error('Error listing users:', error);
      throw error;
    }
  }
} 