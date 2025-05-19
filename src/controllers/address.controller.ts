import { Request, Response } from 'express';
import { AddressService } from '../services/address.service';
import { logger } from '../utils/logger';

export class AddressController {
  private readonly addressService: AddressService;

  constructor() {
    this.addressService = new AddressService();
  }

  addAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const address = await this.addressService.addAddress(userId, req.body);
      res.status(201).json(address);
    } catch (error) {
      logger.error('Error in addAddress controller:', error);
      res.status(500).json({ 
        message: 'Error adding address', 
        error: (error as Error).message 
      });
    }
  };

  updateAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const { addressId } = req.params;
      const address = await this.addressService.updateAddress(
        userId,
        addressId,
        req.body
      );

      if (!address) {
        res.status(404).json({ message: 'Address not found' });
        return;
      }

      res.json(address);
    } catch (error) {
      logger.error('Error in updateAddress controller:', error);
      res.status(500).json({ 
        message: 'Error updating address', 
        error: (error as Error).message 
      });
    }
  };

  deleteAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const { addressId } = req.params;
      await this.addressService.deleteAddress(userId, addressId);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in deleteAddress controller:', error);
      res.status(500).json({ 
        message: 'Error deleting address', 
        error: (error as Error).message 
      });
    }
  };

  getAddresses = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const addresses = await this.addressService.getAddresses(userId);
      res.json(addresses);
    } catch (error) {
      logger.error('Error in getAddresses controller:', error);
      res.status(500).json({ 
        message: 'Error fetching addresses', 
        error: (error as Error).message 
      });
    }
  };

  getAddressById = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const { addressId } = req.params;
      const address = await this.addressService.getAddressById(userId, addressId);

      if (!address) {
        res.status(404).json({ message: 'Address not found' });
        return;
      }

      res.json(address);
    } catch (error) {
      logger.error('Error in getAddressById controller:', error);
      res.status(500).json({ 
        message: 'Error fetching address', 
        error: (error as Error).message 
      });
    }
  };

  setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      const { addressId } = req.params;
      await this.addressService.setDefaultAddress(userId, addressId);
      res.status(200).json({ message: 'Default address updated successfully' });
    } catch (error) {
      logger.error('Error in setDefaultAddress controller:', error);
      res.status(500).json({ 
        message: 'Error setting default address', 
        error: (error as Error).message 
      });
    }
  };
} 