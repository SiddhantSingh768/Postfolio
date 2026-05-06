const Redis  = require('ioredis');
const logger = require('./logger');

let redisClient = null;

const connectRedis = () => {
  redisClient = new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
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

const getRedisClient = () => redisClient;

module.exports = { connectRedis, getRedisClient };  