const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Place this after express-validator check() arrays on a route.
// Collects all validation errors and throws a single AppError.

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => `${e.path}: ${e.msg}`).join(' | ');
    return next(new AppError(400, 'VALIDATION_ERROR', messages));
  }
  next();
};

module.exports = validateRequest;