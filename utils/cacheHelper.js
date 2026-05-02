import NodeCache from "node-cache";

/**
 * Cache Helper Module.
 * Provides functions to get, set, delete, and clear cache entries.
 * Uses a singleton pattern to ensure a single cache instance.
 * Default TTL is set to 3 hours (10800 seconds).
 * This module can be imported and used across the application.
 * This cache is in-memory and will be cleared when the server restarts.
 * This is suitable for small to medium-sized applications.
 * Note: There might be mutiple key for same data set 
 * as per different query params eg: meal , meals etc.
 */
// ✅ Create ONE cache instance and reuse it
const appCache = global._appCache || new NodeCache({ stdTTL: 300, checkperiod: 120 });
if (!global._appCache) {
  global._appCache = appCache;
  console.log("Cache initialized globally");
}

/**
 * Get cached data for a given key.
 */
export function getCache(key) {
  const cached = appCache.get(key);
  if (cached) console.log(` Cache hit for key: ${key}`);
  return cached || null;
}

/**
 * Store data in cache.
 */
export function setCache(key, value, ttl = 10800) {
  ttl = process.env.CACHE_TTL_SECONDS
    ? Number(process.env.CACHE_TTL_SECONDS)
    : ttl;
  appCache.set(key, value, ttl);
  console.log(`Cache set for key: ${key} (TTL ${ttl}s)`);
}

/**
 * Delete a specific cache entry.
 */
export function deleteCache(key) {
  appCache.del(key);
  console.log(`Cache deleted for key: ${key}`);
}

/**
 * Clear all cache entries (useful after major data updates).
 */
export function clearAllCache() {
  appCache.flushAll();
  console.log(" All cache cleared");
}

export default {
  getCache,
  setCache,
  deleteCache,
  clearAllCache,
};
