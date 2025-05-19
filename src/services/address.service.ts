import { User, IAddress } from '../models/user.model';
import { RedisService } from './redis.service';
import { getRedisConfig } from '../config/redis.config';
import { logger } from '../utils/logger';

export class AddressService {
  private readonly redisService: RedisService;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor() {
    this.redisService = RedisService.getInstance(getRedisConfig('default'));
  }

  private async invalidateUserAddressCache(userId: string): Promise<void> {
    const cacheKey = `user:${userId}:addresses`;
    await this.redisService.del(cacheKey);
  }

  async addAddress(userId: string, addressData: Partial<IAddress>): Promise<IAddress> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // If this is a home or work address, ensure only one exists
      if (addressData.addressType === 'home' || addressData.addressType === 'work') {
        const existingAddress = user.addresses.find(
          addr => addr.addressType === addressData.addressType
        );
        if (existingAddress) {
          throw new Error(`${addressData.addressType} address already exists`);
        }
      }

      // If this is marked as default, unset any existing default
      if (addressData.isDefault) {
        user.addresses.forEach(addr => {
          addr.isDefault = false;
        });
      }

      const newAddress: IAddress = {
        ...addressData as IAddress,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      user.addresses.push(newAddress);
      await user.save();

      // Invalidate cache
      await this.invalidateUserAddressCache(userId);

      return newAddress;
    } catch (error) {
      logger.error('Error in addAddress:', error);
      throw error;
    }
  }

  async updateAddress(userId: string, addressId: string, updateData: Partial<IAddress>): Promise<IAddress | null> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const addressIndex = user.addresses.findIndex(
        addr => addr.id.toString() === addressId
      );

      if (addressIndex === -1) {
        throw new Error('Address not found');
      }

      // If changing address type to home/work, check for existing
      if (updateData.addressType && 
          (updateData.addressType === 'home' || updateData.addressType === 'work')) {
        const existingAddress = user.addresses.find(
          addr => addr.addressType === updateData.addressType && 
                 addr._id.toString() !== addressId
        );
        if (existingAddress) {
          throw new Error(`${updateData.addressType} address already exists`);
        }
      }

      // If setting as default, unset any existing default
      if (updateData.isDefault) {
        user.addresses.forEach(addr => {
          addr.isDefault = false;
        });
      }

      // Update address
      user.addresses[addressIndex] = {
        ...user.addresses[addressIndex].toObject(),
        ...updateData,
        updatedAt: new Date()
      };

      await user.save();

      // Invalidate cache
      await this.invalidateUserAddressCache(userId);

      return user.addresses[addressIndex];
    } catch (error) {
      logger.error('Error in updateAddress:', error);
      throw error;
    }
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const addressIndex = user.addresses.findIndex(
        addr => addr._id.toString() === addressId
      );

      if (addressIndex === -1) {
        throw new Error('Address not found');
      }

      user.addresses.splice(addressIndex, 1);
      await user.save();

      // Invalidate cache
      await this.invalidateUserAddressCache(userId);
    } catch (error) {
      logger.error('Error in deleteAddress:', error);
      throw error;
    }
  }

  async getAddresses(userId: string): Promise<IAddress[]> {
    try {
      // Try to get from cache first
      const cacheKey = `user:${userId}:addresses`;
      const cachedAddresses = await this.redisService.get<IAddress[]>(cacheKey);
      
      if (cachedAddresses) {
        return cachedAddresses;
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Cache the addresses
      await this.redisService.set(cacheKey, user.addresses, this.CACHE_TTL);

      return user.addresses;
    } catch (error) {
      logger.error('Error in getAddresses:', error);
      throw error;
    }
  }

  async getAddressById(userId: string, addressId: string): Promise<IAddress | null> {
    try {
      const addresses = await this.getAddresses(userId);
      return addresses.find(addr => addr._id.toString() === addressId) || null;
    } catch (error) {
      logger.error('Error in getAddressById:', error);
      throw error;
    }
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const address = user.addresses.find(
        addr => addr._id.toString() === addressId
      );

      if (!address) {
        throw new Error('Address not found');
      }

      // Unset any existing default
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });

      // Set new default
      address.isDefault = true;
      await user.save();

      // Invalidate cache
      await this.invalidateUserAddressCache(userId);
    } catch (error) {
      logger.error('Error in setDefaultAddress:', error);
      throw error;
    }
  }
} 