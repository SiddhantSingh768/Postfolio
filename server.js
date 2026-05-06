require('dotenv').config();

const http         = require('http');          // ← ADD THIS
const app          = require('./app');
const connectDB    = require('./src/config/db');
const { connectRedis }          = require('./src/config/redis');
const { verifyEmailConnection } = require('./src/config/nodemailer');
const { verifyCloudinaryConnection } = require('./src/config/cloudinary');
const { initSocket }            = require('./src/config/socket');  // ← ADD THIS
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  connectRedis();
  await verifyEmailConnection();
  await verifyCloudinaryConnection();

  // ── Create HTTP server (instead of app.listen) ───────────────────────────
  // Socket.io must attach to the raw HTTP server, not the Express app.
  // This is the only change from Phase 1-5.
  const httpServer = http.createServer(app);

  // Attach Socket.io to the HTTP server
  initSocket(httpServer);

  // Listen on the HTTP server (not app.listen)
  httpServer.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Server started');
  });
};

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

// Add at the bottom of server.js, after startServer()
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, 'Unhandled Promise Rejection');
  // In production, exit gracefully and let Railway restart the process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});