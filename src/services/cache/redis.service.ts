import { createClient, RedisClientType } from "redis";
import logger from "../../utils/logger";
import { CacheService } from "../../types";
import 'dotenv/config';

class RedisService implements CacheService {
  private client: RedisClientType;
  public isConnected: boolean;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        reconnectStrategy: (retries) => {
          const delay = Math.min(retries * 50, 2000);
          logger.info(`Redis reconnecting attempt ${retries}, delay ${delay}ms`);
          return delay;
        },
      },
    });
    this.isConnected = false;
    this.connect();
  }

  async connect(): Promise<void> {
    try {
      this.client.on("error", (err) => {
        logger.error("Redis error:", err);
        this.isConnected = false;
      });

      this.client.on("connect", () => {
        logger.info("Redis connected successfully");
        this.isConnected = true;
      });

      this.client.on("reconnecting", () => {
        logger.info("Redis reconnecting...");
      });

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      logger.error("Failed to connect to Redis:", error);
      this.isConnected = false;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.isConnected) {
      logger.warn("Redis not connected, skipping cache get", { key });
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        if (typeof value === "string") {
          return JSON.parse(value);
        }
        // value is already an object (or other non-string), return as-is
        return value;
      }
      return null;
    } catch (error) {
      logger.error("Redis get error:", { key, error: (error as Error).message });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    if (!this.isConnected) {
      logger.warn("Redis not connected, skipping cache set", { key });
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.client.set(key, serialized, {
        EX: ttlSeconds,
      });
      logger.debug("Cache set successful", { key, ttlSeconds });
      return true;
    } catch (error) {
      logger.error("Redis set error:", { key, error: (error as Error).message });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error("Redis delete error:", { key, error: (error as Error).message });
      return false;
    }
  }

  async getKeys(pattern: string): Promise<string[]> {
    if (!this.isConnected) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error("Redis keys error:", { pattern, error: (error as Error).message });
      return [];
    }
  }

  async clearPattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const keys = await this.getKeys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return keys.length;
    } catch (error) {
      logger.error("Redis clear pattern error:", { pattern, error: (error as Error).message });
      return 0;
    }
  }

  async healthCheck(): Promise<{ status: string; message: string }> {
    if (!this.isConnected) {
      return { status: "disconnected", message: "Redis not connected" };
    }

    try {
      await this.client.ping();
      return { status: "healthy", message: "Redis responding normally" };
    } catch (error) {
      return { status: "unhealthy", message: (error as Error).message };
    }
  }
}

export default new RedisService();
