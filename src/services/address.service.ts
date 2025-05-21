import { Address, IAddress } from '../models/address.model';
import { RedisService } from './redis.service';
import { getRedisConfig } from '../config/redis.config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { LocationService } from './location.service';

export class AddressService {
  private readonly redisService: RedisService;
  private readonly locationService: LocationService;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly BATCH_SIZE = 100; // For pagination

  constructor() {
    this.redisService = RedisService.getInstance(getRedisConfig('default'));
    this.locationService = new LocationService();
  }

  private async invalidateUserAddressCache(userId: string): Promise<void> {
    const cacheKeys = [
      `user:${userId}:addresses`,
      `user:${userId}:addresses:count`,
      `user:${userId}:addresses:default`
    ];
    await Promise.all(cacheKeys.map(key => this.redisService.del(key)));
  }

  private generateAddressId(): string {
    return uuidv4();
  }

  async addAddress(userId: string, addressData: Partial<IAddress>): Promise<IAddress> {
    try {
      // If this is a home or work address, update the existing one if it exists
      if (addressData.addressType === 'home' || addressData.addressType === 'work') {
        const existingAddress = await Address.findOne({
          userId,
          addressType: addressData.addressType
        });

        if (existingAddress) {
          // Update existing address
          const updatedAddress = await Address.findOneAndUpdate(
            { userId, addressType: addressData.addressType },
            { $set: { ...addressData, updatedAt: new Date() } },
            { new: true }
          );

          await this.invalidateUserAddressCache(userId);
          return updatedAddress!;
        }
      }

      // If this is marked as default, unset any existing default
      if (addressData.isDefault) {
        await Address.updateMany(
          { userId },
          { $set: { isDefault: false } }
        );
      }

      // Create new address
      const address = new Address({
        id: this.generateAddressId(),
        userId,
        ...addressData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await address.save();
      await this.invalidateUserAddressCache(userId);

      return address;
    } catch (error) {
      logger.error('Error in addAddress:', error);
      throw error;
    }
  }

  async getAddresses(userId: string, page: number = 1, limit: number = this.BATCH_SIZE): Promise<{ addresses: IAddress[]; total: number }> {
    try {
      const cacheKey = `user:${userId}:addresses:${page}:${limit}`;
      const countCacheKey = `user:${userId}:addresses:count`;

      // Try to get from cache first
      const [cachedAddresses, cachedCount] = await Promise.all([
        this.redisService.get<IAddress[]>(cacheKey),
        this.redisService.get<number>(countCacheKey)
      ]);

      if (cachedAddresses && cachedCount) {
        return { addresses: cachedAddresses, total: cachedCount };
      }

      const skip = (page - 1) * limit;
      const [addresses, total] = await Promise.all([
        Address.find({ userId })
          .sort({ isDefault: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Address.countDocuments({ userId })
      ]);

      // Cache the results
      await Promise.all([
        this.redisService.set(cacheKey, addresses, this.CACHE_TTL),
        this.redisService.set(countCacheKey, total, this.CACHE_TTL)
      ]);

      return { addresses, total };
    } catch (error) {
      logger.error('Error in getAddresses:', error);
      throw error;
    }
  }

  async updateAddress(userId: string, addressId: string, updateData: Partial<IAddress>): Promise<IAddress | null> {
    try {
      const user = await Address.findOne({ userId, id: addressId });
      if (!user) {
        throw new Error('Address not found');
      }

      // If changing address type to home/work, check for existing
      if (updateData.addressType && 
          (updateData.addressType === 'home' || updateData.addressType === 'work')) {
        const existingAddress = await Address.findOne({
          userId,
          addressType: updateData.addressType
        });
        if (existingAddress) {
          throw new Error(`${updateData.addressType} address already exists`);
        }
      }

      // If setting as default, unset any existing default
      if (updateData.isDefault) {
        await Address.updateMany(
          { userId },
          { $set: { isDefault: false } }
        );
      }

      // Update address
      const updatedAddress = await Address.findOneAndUpdate(
        { userId, id: addressId },
        { $set: { ...updateData, updatedAt: new Date() } },
        { new: true }
      });

      await this.invalidateUserAddressCache(userId);

      return updatedAddress!;
    } catch (error) {
      logger.error('Error in updateAddress:', error);
      throw error;
    }
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    try {
      const user = await Address.findOne({ userId, id: addressId });
      if (!user) {
        throw new Error('Address not found');
      }

      await user.remove();
      await this.invalidateUserAddressCache(userId);
    } catch (error) {
      logger.error('Error in deleteAddress:', error);
      throw error;
    }
  }

  async getAddressById(userId: string, addressId: string): Promise<IAddress | null> {
    try {
      const addresses = await this.getAddresses(userId);
      return addresses.addresses.find(addr => addr.id === addressId) || null;
    } catch (error) {
      logger.error('Error in getAddressById:', error);
      throw error;
    }
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    try {
      const user = await Address.findOne({ userId, id: addressId });
      if (!user) {
        throw new Error('Address not found');
      }

      // Unset any existing default
      await Address.updateMany(
        { userId },
        { $set: { isDefault: false } }
      );

      // Set new default
      user.isDefault = true;
      await user.save();

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
        location: {
          type: 'Point',
          coordinates: [
            placeDetails.geometry.location.lng,
            placeDetails.geometry.location.lat
          ]
        },
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