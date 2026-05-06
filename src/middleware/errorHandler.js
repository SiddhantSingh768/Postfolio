const logger   = require('../config/logger');
const AppError = require('../utils/AppError');

const errorHandler = (err, req, res, next) => {
  if (err.isOperational) {
    logger.warn({ code: err.code, status: err.statusCode, path: req.path }, err.message);
  } else {
    logger.error({ err, path: req.path }, 'Unexpected error');
  }
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status:  'error',
      code:    err.code,
      message: err.message
    });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      status: 'error', code: 'DUPLICATE_KEY', message: `${field} already exists`
    });
  }
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message).join(', ');
    return res.status(400).json({
      status: 'error', code: 'VALIDATION_ERROR', message: messages
    });
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ status: 'error', code: 'INVALID_TOKEN', message: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ status: 'error', code: 'TOKEN_EXPIRED', message: 'Token expired' });
  }

  return res.status(500).json({
    status:  'error',
    code:    'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

module.exports = errorHandler;