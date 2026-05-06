const rateLimit      = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');

// Creates a configured rate limiter middleware.
// Uses Redis store if available, falls back to in-memory store silently.
// The in-memory fallback is fine for a single instance — the redis store
// is what matters once you run multiple server instances.

const createLimiter = ({ windowMs, max, message }) => {
  const client = getRedisClient();
  const config = {
    windowMs,
    max,
    standardHeaders: true,  // Adds RateLimit-* headers to responses
    legacyHeaders:   false,
    message: { status: 'error', code: 'RATE_LIMIT_EXCEEDED', message }
  };

  if (client && client.status === 'ready') {
    config.store = new RedisStore({
      sendCommand: (...args) => client.call(...args)
    });
  }

  // Disable rate limiting in tests so we don't accidentally block legitimate test requests
  if (process.env.NODE_ENV === 'test') {
    return (req, res, next) => next();
  }

  return rateLimit(config);
};

const loginLimiter    = createLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: 'Too many login attempts. Try again in 15 minutes.' });
const registerLimiter = createLimiter({ windowMs: 60 * 60 * 1000, max: 5,  message: 'Too many registration attempts from this IP.' });
const generalLimiter  = createLimiter({ windowMs: 15 * 60 * 1000, max: 100, message: 'Too many requests.' });

module.exports = { loginLimiter, registerLimiter, generalLimiter };