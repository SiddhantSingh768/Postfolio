const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

// Cache service abstracts Redis operations.
// Every method degrades gracefully — if Redis is unavailable,
// the app continues to work, just without caching.

const DEFAULT_TTL = 300; // 5 minutes in seconds

// Get a cached value
// Returns parsed JSON if found, null if not found or Redis unavailable
const get = async (key) => {
  try {
    const client = getRedisClient();
    if (!client || client.status !== 'ready') return null;

    const value = await client.get(key);
    if (!value) return null;

    return JSON.parse(value);
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Cache get failed');
    return null; // Degrade gracefully
  }
};

// Set a value in cache with TTL
// Returns true if successful, false if failed
const set = async (key, value, ttlSeconds = DEFAULT_TTL) => {
  try {
    const client = getRedisClient();
    if (!client || client.status !== 'ready') return false;

    await client.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Cache set failed');
    return false;
  }
};

// Delete a cached value (cache invalidation)
const del = async (key) => {
  try {
    const client = getRedisClient();
    if (!client || client.status !== 'ready') return false;

    await client.del(key);
    return true;
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Cache delete failed');
    return false;
  }
};

// Delete multiple keys matching a pattern
// Used to invalidate all dashboard keys for a workspace
const delPattern = async (pattern) => {
  try {
    const client = getRedisClient();
    if (!client || client.status !== 'ready') return false;

    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
      logger.info({ pattern, count: keys.length }, 'Cache pattern invalidated');
    }
    return true;
  } catch (err) {
    logger.warn({ err: err.message, pattern }, 'Cache pattern delete failed');
    return false;
  }
};

// Cache key builders — centralised so key format never drifts
const keys = {
  dashboard:  (workspaceId) => `dashboard:${workspaceId}`,
  revenue:    (workspaceId, months) => `revenue:${workspaceId}:${months}`,
};

module.exports = { get, set, del, delPattern, keys };