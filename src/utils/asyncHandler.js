// Wraps async route handlers so thrown errors reach errorHandler automatically.
// Without this, an unhandled async rejection silently crashes in older Node versions
// or produces an UnhandledPromiseRejection warning in Node 20.

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;