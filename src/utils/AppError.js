// Every intentional error thrown in services is an AppError.
// The global error handler uses `isOperational` to distinguish
// "we threw this on purpose" from "something unexpected crashed".

class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode    = statusCode;
    this.code          = code;     // Machine-readable: 'EMAIL_EXISTS', 'INVALID_OTP'
    this.isOperational = true;     // Our error — send the specific message to client
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;