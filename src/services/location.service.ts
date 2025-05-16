import axios from "axios";
import { logger } from "../utils/logger";
import { RedisService } from "./redis.service";

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
  private readonly baseUrl: string = "https://maps.googleapis.com/maps/api/place";
  private readonly redisService: RedisService;
  private readonly CACHE_TTL = 3600; // 1 hour in seconds

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY || "";
    if (!this.apiKey) {
      logger.error("Google Maps API key is not configured");
    }
    this.redisService = RedisService.getInstance();
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
      // Check Redis cache first
      const cacheKey = `location:search:${query}:${sessionToken || "default"}`;
      const cachedResults = await this.redisService.get<PlacePrediction[]>(cacheKey);
      
      if (cachedResults) {
        logger.info(`Cache hit for search query: ${query}`);
        return cachedResults;
      }

      // Acquire distributed lock to prevent cache stampede
      const lockKey = `lock:${cacheKey}`;
      const hasLock = await this.redisService.acquireLock(lockKey, 10); // 10 seconds lock

      if (!hasLock) {
        // If we couldn't acquire the lock, wait briefly and try cache again
        await new Promise(resolve => setTimeout(resolve, 100));
        const retryResults = await this.redisService.get<PlacePrediction[]>(cacheKey);
        if (retryResults) {
          return retryResults;
        }
      }

      try {
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

        // Cache the results in Redis
        await this.redisService.set(cacheKey, response.predictions, this.CACHE_TTL);

        return response.predictions;
      } finally {
        if (hasLock) {
          await this.redisService.releaseLock(lockKey);
        }
      }
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
      // Check Redis cache first
      const cacheKey = `location:details:${placeId}:${sessionToken || "default"}`;
      const cachedDetails = await this.redisService.get<PlaceDetails>(cacheKey);
      
      if (cachedDetails) {
        logger.info(`Cache hit for place details: ${placeId}`);
        return cachedDetails;
      }

      // Acquire distributed lock to prevent cache stampede
      const lockKey = `lock:${cacheKey}`;
      const hasLock = await this.redisService.acquireLock(lockKey, 10); // 10 seconds lock

      if (!hasLock) {
        // If we couldn't acquire the lock, wait briefly and try cache again
        await new Promise(resolve => setTimeout(resolve, 100));
        const retryDetails = await this.redisService.get<PlaceDetails>(cacheKey);
        if (retryDetails) {
          return retryDetails;
        }
      }

      try {
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

        // Cache the results in Redis
        await this.redisService.set(cacheKey, response.result, this.CACHE_TTL);

        return response.result;
      } finally {
        if (hasLock) {
          await this.redisService.releaseLock(lockKey);
        }
      }
    } catch (error) {
      logger.error("Error in getPlaceDetails:", error);
      throw error;
    }
  }
}
