import { User, IUser } from '../models/user.model';
import { logger } from '../utils/logger';

export class UserService {
  private validateCountryCode(countryCode: string): boolean {
    // ISO 3166-1 alpha-2 country codes
    const validCountryCodes = new Set([
      'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'JP', 'KR', 'CN', 'IN', 'BR', 'MX'
      // Add more country codes as needed
    ]);
    return validCountryCodes.has(countryCode.toUpperCase());
  }

  private formatPhoneNumber(phone: string, countryCode: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith(countryCode)) {
      return `${countryCode}${cleaned}`;
    }
    
    return cleaned;
  }

  async createUser(userData: Partial<IUser>): Promise<IUser> {
    try {
      // Validate country code
      if (userData.countryCode && !this.validateCountryCode(userData.countryCode)) {
        throw new Error('Invalid country code');
      }

      // Format phone number with country code
      if (userData.phone && userData.countryCode) {
        userData.phone = this.formatPhoneNumber(userData.phone, userData.countryCode);
      }

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