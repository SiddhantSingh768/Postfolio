const Redis  = require('ioredis');
const logger = require('./logger');

let redisClient = null;

const connectRedis = () => {
  redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    // retryStrategy controls what happens when a connection attempt fails.
    // Return null after 3 attempts to stop retrying — app continues without Redis.
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('Redis unavailable after 3 retries — degraded mode (no cache, in-memory rate limiting)');
        return null;
      }
      return Math.min(times * 200, 2000);
    }
  });

  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('error',   (err) => logger.warn({ err: err.message }, 'Redis error'));

  return redisClient;
};

// Always go through this getter — never import redisClient directly.
// It returns null if Redis never connected, which callers must handle gracefully.
const getRedisClient = () => redisClient;

module.exports = { connectRedis, getRedisClient };  