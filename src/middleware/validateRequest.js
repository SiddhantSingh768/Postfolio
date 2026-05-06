const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => `${e.path}: ${e.msg}`).join(' | ');
    return next(new AppError(400, 'VALIDATION_ERROR', messages));
  }
  next();
};

module.exports = validateRequest;