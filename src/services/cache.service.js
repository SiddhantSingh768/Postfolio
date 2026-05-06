const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');


const DEFAULT_TTL = 300; 

const get = async (key) => {
  try {
    const client = getRedisClient();
    if (!client || client.status !== 'ready') return null;

    const value = await client.get(key);
    if (!value) return null;

    return JSON.parse(value);
  } catch (err) {
    logger.warn({ err: err.message, key }, 'Cache get failed');
    return null;
  }
};

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

const keys = {
  dashboard:  (workspaceId) => `dashboard:${workspaceId}`,
  revenue:    (workspaceId, months) => `revenue:${workspaceId}:${months}`,
};

module.exports = { get, set, del, delPattern, keys };