import axios from "axios";
import NodeCache from "node-cache";
import { logger } from "../utils/logger";

// Cache for 1 hour
const cache = new NodeCache({ stdTTL: 3600 });

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface PlaceDetails {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
  types: string[];
}

export class LocationService {
  private readonly apiKey: string;
  private readonly baseUrl: string =
    "https://maps.googleapis.com/maps/api/place";

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    if (!this.apiKey) {
      logger.error("Google Maps API key is not configured");
    }
  }

  private async makeGoogleRequest<T>(
    endpoint: string,
    params: Record<string, string>
  ): Promise<T> {
    try {
      const response = await axios.get(`${this.baseUrl}/${endpoint}`, {
        params: {
          ...params,
          key: this.apiKey,
        },
      });

      if (
        response.data.status !== "OK" &&
        response.data.status !== "ZERO_RESULTS"
      ) {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      return response.data;
    } catch (error) {
      logger.error("Error making Google Places API request:", error);
      throw error;
    }
  }

  async searchAddress(
    query: string,
    sessionToken?: string
  ): Promise<PlacePrediction[]> {
    try {
      // Check cache first
      const cacheKey = `search_${query}_${sessionToken || "default"}`;
      const cachedResults = cache.get<PlacePrediction[]>(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      const params: Record<string, string> = {
        input: query,
        types: "address",
        components: "country:us", // Restrict to US addresses
        language: "en",
      };

      if (sessionToken) {
        params.sessiontoken = sessionToken;
      }

      const response = await this.makeGoogleRequest<{
        predictions: PlacePrediction[];
      }>("autocomplete/json", params);

      // Cache the results
      cache.set(cacheKey, response.predictions);

      return response.predictions;
    } catch (error) {
      logger.error("Error in searchAddress:", error);
      throw error;
    }
  }

  async getPlaceDetails(
    placeId: string,
    sessionToken?: string
  ): Promise<PlaceDetails> {
    try {
      // Check cache first
      const cacheKey = `details_${placeId}_${sessionToken || "default"}`;
      const cachedDetails = cache.get<PlaceDetails>(cacheKey);
      if (cachedDetails) {
        return cachedDetails;
      }

      const params: Record<string, string> = {
        place_id: placeId,
        fields: "formatted_address,geometry,place_id,types",
      };

      if (sessionToken) {
        params.sessiontoken = sessionToken;
      }

      const response = await this.makeGoogleRequest<{ result: PlaceDetails }>(
        "details/json",
        params
      );

      // Cache the results
      cache.set(cacheKey, response.result);

      return response.result;
    } catch (error) {
      logger.error("Error in getPlaceDetails:", error);
      throw error;
    }
  }
}
