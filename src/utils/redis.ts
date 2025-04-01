import Redis from "ioredis";

// Create Redis client with connection string
const redisClient = new Redis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    retryStrategy: (times) => Math.min(times * 50, 2000),
  }
);

// Error handling
redisClient.on("error", (err) => console.error("Redis Client Error:", err));
redisClient.on("connect", () => console.log("Connected to Redis"));

// In-memory fallback cache
// In-memory fallback cache
const memoryCache: { [key: string]: { value: any; expiry: number } } = {};

// Set cache with default expiry (5 min)
export const setCache = async (key: string, value: any, expireTime = 900) => {
  try {
    const stringValue = JSON.stringify(value);

    // Store in Redis
    await redisClient.setex(key, expireTime, stringValue);

    // Store in in-memory cache
    memoryCache[key] = { value, expiry: Date.now() + 900000 };

    return true;
  } catch (error) {
    console.error("Redis Set Error:", error);
    return false;
  }
};

// Get cache with memory fallback
export const getCache = async (key: string) => {
  try {
    // Check in-memory cache first
    const cachedItem = memoryCache[key];
    if (cachedItem && cachedItem.expiry > Date.now()) {
      return cachedItem.value;
    }

    // Check in Redis
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Redis Get Error:", error);
    return memoryCache[key]?.value || null;
  }
};

// Delete cache with memory fallback
export const deleteCache = async (key: string) => {
  try {
    // Delete from Redis
    await redisClient.del(key);

    // Delete from in-memory cache
    delete memoryCache[key];

    return true;
  } catch (error) {
    console.error("Redis Delete Error:", error);
    return false;
  }
};

// Periodically clean expired in-memory cache
setInterval(() => {
  const now = Date.now();
  Object.keys(memoryCache).forEach((key) => {
    if (memoryCache[key].expiry < now) {
      delete memoryCache[key];
    }
  });
}, 60000); // Run every 60 seconds

export default redisClient;
