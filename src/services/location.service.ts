import {
  Client,
  PlaceAutocompleteRequest,
  PlaceAutocompleteResponse,
  PlaceAutocompleteResult,
  PlaceAutocompleteType,
  PlaceDetailsRequest,
  Status,
} from "@googlemaps/google-maps-services-js";
import { getRedisConfig } from "../config/redis.config";
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
  private readonly client: Client;
  private readonly redisService: RedisService;
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second
  private readonly metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    errors: 0,
  };

  constructor() {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("Google Maps API key is not configured");
    }

    this.client = new Client({});
    this.redisService = RedisService.getInstance(
      getRedisConfig("location_service")
    );
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retries: number = this.MAX_RETRIES
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY));
        return this.retryWithBackoff(operation, retries - 1);
      }
      throw error;
    }
  }

  private async makeGoogleRequest<T>(
    request: PlaceAutocompleteRequest | PlaceDetailsRequest
  ): Promise<T> {
    try {
      this.metrics.apiCalls++;
      const response = await this.client.placeAutocomplete(
        request as PlaceAutocompleteRequest
      );
      if (
        response.data.status !== Status.OK &&
        response.data.status !== Status.ZERO_RESULTS
      ) {
        throw new Error(`Google Maps API error: ${response.data.status}`);
      }

      return response as T;
    } catch (error) {
      this.metrics.errors++;
      logger.error("Google Maps API error:", error);
      throw error;
    }
  }

  async searchAddress(
    query: string,
    sessionToken?: string
  ): Promise<PlacePrediction[]> {
    try {
      // Check Redis cache first
      const cacheKey = `location:search:${query}:${sessionToken ?? "default"}`;
      const cachedResults =
        await this.redisService.get<PlacePrediction[]>(cacheKey);

      if (cachedResults) {
        this.metrics.cacheHits++;
        logger.info(`Cache hit for search query: ${query}`);
        return cachedResults;
      }

      this.metrics.cacheMisses++;

      // Acquire distributed lock to prevent cache stampede
      const lockKey = `lock:${cacheKey}`;
      const hasLock = await this.redisService.acquireLock(lockKey, 10);

      if (!hasLock) {
        // If we couldn't acquire the lock, wait briefly and try cache again
        await new Promise((resolve) => setTimeout(resolve, 100));
        const retryResults =
          await this.redisService.get<PlacePrediction[]>(cacheKey);
        if (retryResults) {
          return retryResults;
        }
      }

      try {
        const request: PlaceAutocompleteRequest = {
          params: {
            input: query,
            types: PlaceAutocompleteType.address,
            components: ["country:us"],
            language: "en",
            key: process.env.GOOGLE_MAPS_API_KEY!,
            sessiontoken: sessionToken,
          },
        };

        const response = await this.retryWithBackoff(() =>
          this.makeGoogleRequest<PlaceAutocompleteResponse>(request)
        );

        const predictions = (response.data.predictions || []).map(
          (prediction: PlaceAutocompleteResult) => ({
            place_id: prediction.place_id,
            description: prediction.description,
            structured_formatting: {
              main_text: prediction.structured_formatting?.main_text || "",
              secondary_text:
                prediction.structured_formatting?.secondary_text || "",
            },
          })
        );

        // Cache the results in Redis
        await this.redisService.set(cacheKey, predictions, this.CACHE_TTL);

        return predictions;
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
      const cacheKey = `location:details:${placeId}:${sessionToken ?? "default"}`;
      const cachedDetails = await this.redisService.get<PlaceDetails>(cacheKey);

      if (cachedDetails) {
        this.metrics.cacheHits++;
        logger.info(`Cache hit for place details: ${placeId}`);
        return cachedDetails;
      }

      this.metrics.cacheMisses++;

      // Acquire distributed lock to prevent cache stampede
      const lockKey = `lock:${cacheKey}`;
      const hasLock = await this.redisService.acquireLock(lockKey, 10);

      if (!hasLock) {
        // If we couldn't acquire the lock, wait briefly and try cache again
        await new Promise((resolve) => setTimeout(resolve, 100));
        const retryDetails =
          await this.redisService.get<PlaceDetails>(cacheKey);
        if (retryDetails) {
          return retryDetails;
        }
      }

      try {
        const request: PlaceDetailsRequest = {
          params: {
            place_id: placeId,
            fields: ["formatted_address", "geometry", "place_id", "types"],
            key: process.env.GOOGLE_MAPS_API_KEY!,
            sessiontoken: sessionToken || "",
          },
        };

        const response = await this.retryWithBackoff(() =>
          this.client.placeDetails(request)
        );

        if (response.data.status !== Status.OK) {
          throw new Error(`Google Maps API error: ${response.data.status}`);
        }

        const details: PlaceDetails = {
          formatted_address: response.data.result.formatted_address || "",
          geometry: {
            location: {
              lat: response.data.result.geometry?.location.lat || 0,
              lng: response.data.result.geometry?.location.lng || 0,
            },
          },
          place_id: response.data.result.place_id || "",
          types: response.data.result.types || [],
        };

        // Cache the results in Redis
        await this.redisService.set(cacheKey, details, this.CACHE_TTL);

        return details;
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

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      // Test Redis connection
      await this.redisService.exists("health-check");

      // Test Google Maps API
      const request: PlaceAutocompleteRequest = {
        params: {
          input: "test",
          key: process.env.GOOGLE_MAPS_API_KEY!,
        },
      };
      await this.client.placeAutocomplete(request);

      return true;
    } catch (error) {
      logger.error("Health check failed:", error);
      return false;
    }
  }

  // Get metrics
  getMetrics() {
    return { ...this.metrics };
  }

  // Reset metrics
  resetMetrics() {
    Object.keys(this.metrics).forEach((key) => {
      this.metrics[key as keyof typeof this.metrics] = 0;
    });
  }
}
