import Redis from "ioredis";
import logger from "./logger";
import {
  REDIS_DENYLIST_PREFIX,
  REDIS_RATE_LIMIT_PREFIX,
  DEFAULT_REDIS_CACHE_EXPIRY_SECONDS,
} from "../config/constants";
import dotenv from "dotenv";

dotenv.config();

// Add connection pooling and better error handling
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create Redis instance with improved options
const redisClient = new Redis(REDIS_URL, {
  tls: {},
  retryStrategy(times) {
    const delay = Math.min(1000 * Math.pow(2, times), 30000);
    return delay + Math.floor(Math.random() * 1000);
  },

  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  // keepAlive: 30000,
  // lazyConnect: false,
});

let isConnected = false;

redisClient.on("connect", () => {
  isConnected = true;
  logger.info("Connected to Redis");
});

redisClient.on("ready", () => {
  logger.info("Redis is ready");
});

redisClient.on("error", (err) => {
  if (!isConnected) {
    logger.error({ err }, "Initial Redis connection failed.");
  } else {
    logger.error({ err }, "Redis Client Error");
  }
});

redisClient.on("close", () => {
  isConnected = false;
  logger.warn("Redis connection closed");
});

redisClient.on("reconnecting", (delay) => {
  logger.warn(`Redis reconnecting in ${delay}ms...`);
});

redisClient.on("end", () => {
  logger.warn("Redis connection ended");
});

/**
 * In-memory cache as a fallback or quick access layer.
 * This is not used for critical features like denylist or rate limiting which rely solely on Redis.
 */
const memoryCache: { [key: string]: { value: any; expiry: number } } = {};

/**
 * Sets a value in the cache (Redis and in-memory fallback).
 * @param key - The cache key.
 * @param value - The value to store (will be JSON.stringified).
 * @param expireTime - Expiration time in seconds. Defaults to `DEFAULT_REDIS_CACHE_EXPIRY_SECONDS`.
 * @returns True if successful, false otherwise.
 */
export const setCache = async (
  key: string,
  value: any,
  expireTime = DEFAULT_REDIS_CACHE_EXPIRY_SECONDS
): Promise<boolean> => {
  try {
    const stringValue = JSON.stringify(value);
    await redisClient.setex(key, expireTime, stringValue);
    memoryCache[key] = { value, expiry: Date.now() + expireTime * 1000 };
    return true;
  } catch (error) {
    logger.error(
      { err: error, key, expireTime },
      "Redis Set Error for general cache"
    );
    return false;
  }
};

/**
 * Gets a value from the cache, checking in-memory fallback first, then Redis.
 * @param key - The cache key.
 * @returns The parsed value if found and not expired, otherwise null.
 */
export const getCache = async (key: string): Promise<any | null> => {
  try {
    const cachedItem = memoryCache[key];
    if (cachedItem && cachedItem.expiry > Date.now()) {
      return cachedItem.value;
    }
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error({ err: error, key }, "Redis Get Error for general cache");
    const cachedItemOnError = memoryCache[key];
    if (cachedItemOnError && cachedItemOnError.expiry > Date.now()) {
      return cachedItemOnError.value;
    }
    return null;
  }
};

/**
 * Deletes a value from both Redis and the in-memory fallback cache.
 * @param key - The cache key to delete.
 * @returns True if successful or key didn't exist, false on error.
 */
export const deleteCache = async (key: string): Promise<boolean> => {
  try {
    await redisClient.del(key);
    delete memoryCache[key];
    return true;
  } catch (error) {
    logger.error({ err: error, key }, "Redis Delete Error for general cache");
    return false;
  }
};

/**
 * Adds a JWT's JTI (JWT ID) to the denylist in Redis.
 * The token is stored until its original expiration time.
 * @param jti - The JTI of the token to denylist.
 * @param tokenExpiryTimestamp - The original expiration timestamp (in seconds since epoch) of the token.
 * @returns True if the token was successfully added to denylist or was already expired, false on error.
 */
export const addTokenToDenylist = async (
  jti: string,
  tokenExpiryTimestamp: number
): Promise<boolean> => {
  if (!jti) {
    logger.warn("Attempted to denylist a token without a JTI.");
    return false;
  }
  try {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const remainingValidityInSeconds = tokenExpiryTimestamp - nowInSeconds;

    if (remainingValidityInSeconds <= 0) {
      logger.debug({ jti }, "Token already expired, not adding to denylist.");
      return true;
    }

    await redisClient.setex(
      `${REDIS_DENYLIST_PREFIX}${jti}`,
      remainingValidityInSeconds,
      "revoked"
    );
    logger.info(
      { jti, validityInSeconds: remainingValidityInSeconds },
      "Token JTI added to denylist"
    );
    return true;
  } catch (error) {
    logger.error({ err: error, jti }, "Redis Set (Denylist) Error");
    return false;
  }
};

/**
 * Checks if a JWT's JTI is in the denylist.
 * @param jti - The JTI of the token to check.
 * @returns True if the token is denylisted, false otherwise or on error.
 */
export const isTokenDenylisted = async (jti: string): Promise<boolean> => {
  if (!jti) {
    logger.warn("Attempted to check denylist for a token without a JTI.");
    return false;
  }
  try {
    const result = await redisClient.exists(`${REDIS_DENYLIST_PREFIX}${jti}`);
    return result === 1;
  } catch (error) {
    logger.error(
      { err: error, jti },
      "Redis Exists (Denylist) Error. Failing open (token not denylisted)."
    );
    return false;
  }
};

/**
 * Checks and enforces rate limits for a given action and identifier.
 * @param actionKey - A unique key for the action being rate-limited.
 * @param identifier - A unique identifier for the entity performing the action.
 * @param limitWindowSeconds - The duration of the rate limiting window in seconds.
 * @param maxAttempts - The maximum number of attempts allowed within the window.
 * @returns An object indicating if the action is allowed, attempts made, and retryAfterSeconds if disallowed.
 */
export const checkRateLimit = async (
  actionKey: string,
  identifier: string,
  limitWindowSeconds: number,
  maxAttempts: number
): Promise<{
  allow: boolean;
  attemptsMade: number;
  retryAfterSeconds?: number;
}> => {
  if (!redisClient || !redisClient.status || redisClient.status !== "ready") {
    logger.warn(
      { actionKey, identifier, redisStatus: redisClient?.status },
      "Redis client not ready for rate limiting. Allowing request."
    );
    return { allow: true, attemptsMade: 0 };
  }

  const redisKey = `${REDIS_RATE_LIMIT_PREFIX}${actionKey}:${identifier}`;
  let attemptsMade = 0;
  let ttl = -1;

  try {
    attemptsMade = await redisClient.incr(redisKey);

    if (attemptsMade === 1) {
      await redisClient.expire(redisKey, limitWindowSeconds);
      ttl = limitWindowSeconds;
    } else {
      ttl = await redisClient.ttl(redisKey);
    }

    if (attemptsMade > maxAttempts) {
      logger.warn(
        { actionKey, identifier, attemptsMade, maxAttempts, ttl },
        "Rate limit exceeded"
      );
      return {
        allow: false,
        attemptsMade,
        retryAfterSeconds: ttl > 0 ? ttl : limitWindowSeconds,
      };
    }

    return { allow: true, attemptsMade };
  } catch (error) {
    logger.error(
      { err: error, key: redisKey, actionKey, identifier },
      "Redis Rate Limit Check Error. Allowing request."
    );
    return { allow: true, attemptsMade: 0 };
  }
};

/**
 * Periodically cleans expired items from the in-memory fallback cache.
 */
setInterval(() => {
  const now = Date.now();
  let clearedCount = 0;
  Object.keys(memoryCache).forEach((key) => {
    if (memoryCache[key].expiry < now) {
      delete memoryCache[key];
      clearedCount++;
    }
  });
  if (clearedCount > 0) {
    logger.debug(
      { clearedCount },
      "Cleaned expired items from in-memory cache."
    );
  }
}, 60000);

export default redisClient;
