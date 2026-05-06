const rateLimit      = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');

const createLimiter = ({ windowMs, max, message }) => {
  const client = getRedisClient();
  const config = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { status: 'error', code: 'RATE_LIMIT_EXCEEDED', message }
  };

  if (client && client.status === 'ready') {
    config.store = new RedisStore({
      sendCommand: (...args) => client.call(...args)
    });
  }

  if (process.env.NODE_ENV === 'test') {
    return (req, res, next) => next();
  }

  return rateLimit(config);
};

const loginLimiter    = createLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Try again in 15 minutes.' });
const registerLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: 5,  message: 'Too many registration attempts from this IP.' });
const generalLimiter  = createLimiter({ windowMs: 15 * 60 * 1000, max: 100, message: 'Too many requests.' });

module.exports = { loginLimiter, registerLimiter, generalLimiter };