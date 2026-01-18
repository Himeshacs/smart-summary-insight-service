import { createClient } from "redis";
import 'dotenv/config';

export const redisClient = createClient({
  url: process.env.REDIS_URL,
});


redisClient.on("connect", () => {
  console.log("✅ Redis connected");
});

redisClient.on("reconnecting", () => {
  console.log("🔄 Redis reconnecting...");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis error:", err?.message || err);
});


//helper function to reds connection

export const connectRedis = async () => {
  if (redisClient.isOpen) return;

  try {
    await redisClient.connect();
  } catch (err) {
    console.error("❌ Redis initial connection failed:", err);
    throw err;
  }
};
