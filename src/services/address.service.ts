import { User, IAddress } from '../models/user.model';
import { RedisService } from './redis.service';
import { getRedisConfig } from '../config/redis.config';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import { LocationService } from './location.service';

export class AddressService {
  private readonly redisService: RedisService;
  private readonly locationService: LocationService;
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor() {
    this.redisService = RedisService.getInstance(getRedisConfig('default'));
    this.locationService = new LocationService();
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

      const newAddress = new mongoose.Types.ObjectId();
      console.log("address", addressData);
      const address: IAddress = {
        _id: newAddress,
        ...addressData as Omit<IAddress, '_id'>,
        createdAt: new Date(),
        updatedAt: new Date()
      } as IAddress;

      user.addresses.push(address);
      await user.save();

      // Invalidate cache
      await this.invalidateUserAddressCache(userId);

      return address;
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
        addr => addr._id.toString() === addressId
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
      const updatedAddress = {
        ...user.addresses[addressIndex].toObject(),
        ...updateData,
        updatedAt: new Date()
      };

      user.addresses[addressIndex] = updatedAddress as IAddress;
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
      console.log("getAddresses service", userId);
      // Try to get from cache first
      const cacheKey = `user:${userId}:addresses`;
      const cachedAddresses = await this.redisService.get<IAddress[]>(cacheKey);
      
      if (cachedAddresses) {
        console.log("cachedAddresses", cachedAddresses);
        return cachedAddresses;
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      console.log("user.addresses", user);

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

  async addAddressFromPlaces(userId: string, placeId: string, addressData: {
    label: string;
    addressType: 'home' | 'work' | 'custom';
    dropOffOptions?: {
      handItToMe: boolean;
      leaveAtDoor: boolean;
    };
    instructions?: string;
    isDefault?: boolean;
  }): Promise<IAddress> {
    try {
      // Get place details from Google Places API
      const placeDetails = await this.locationService.getPlaceDetails(placeId);

      // Parse the formatted address into components
      const addressComponents = this.parseFormattedAddress(placeDetails.formatted_address);

      // Create the address object
      const address: Partial<IAddress> = {
        label: addressData.label,
        street: addressComponents.street,
        city: addressComponents.city,
        state: addressComponents.state,
        zipCode: addressComponents.zipCode,
        country: addressComponents.country,
        addressType: addressData.addressType,
        dropOffOptions: addressData.dropOffOptions || {
          handItToMe: false,
          leaveAtDoor: false
        },
        instructions: addressData.instructions,
        isDefault: addressData.isDefault || false
      };

      // Add the address to the user
      return await this.addAddress(userId, address);
    } catch (error) {
      logger.error('Error in addAddressFromPlaces:', error);
      throw error;
    }
  }

  private parseFormattedAddress(formattedAddress: string): {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  } {
    // Split the address into components
    const parts = formattedAddress.split(',').map(part => part.trim());
    
    // Extract components
    const street = parts[0] || '';
    const city = parts[1] || '';
    const stateZip = parts[2] || '';
    const country = parts[3] || 'US';

    // Split state and zip code
    const stateZipParts = stateZip.split(' ');
    const state = stateZipParts[0] || '';
    const zipCode = stateZipParts[1] || '';

    return {
      street,
      city,
      state,
      zipCode,
      country
    };
  }
} 