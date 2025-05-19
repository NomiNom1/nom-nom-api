import { Request, Response } from "express";
import { LocationService } from "../services/location.service";
import { logger } from "../utils/logger";

export class LocationController {
  private readonly locationService: LocationService;

  constructor() {
    this.locationService = new LocationService();
  }

  searchAddress = async (req: Request, res: Response): Promise<void> => {
    try {
      const { query } = req.query;

      if (!query || typeof query !== "string") {
        res.status(400).json({ message: "Query parameter is required" });
        return;
      }

      const predictions = await this.locationService.searchAddress(
        query,
        // sessionToken as string | undefined
      );

      res.json({ predictions });
    } catch (error) {
      logger.error("Error in searchAddress controller:");
      res.status(500).json({
        message: "Error searching address",
        error: (error as Error).message,
      });
    }
  };

  getPlaceDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { placeId, sessionToken } = req.query;

      if (!placeId || typeof placeId !== "string") {
        res.status(400).json({ message: "Place ID is required" });
        return;
      }

      const details = await this.locationService.getPlaceDetails(
        placeId,
        sessionToken as string | undefined
      );

      res.json({ details });
    } catch (error) {
      logger.error("Error in getPlaceDetails controller:", error);
      res.status(500).json({
        message: "Error getting place details",
        error: (error as Error).message,
      });
    }
  };
}
