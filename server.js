require('dotenv').config();

const http         = require('http');          
const app          = require('./app');
const connectDB    = require('./src/config/db');
const { connectRedis }          = require('./src/config/redis');
const { verifyEmailConnection } = require('./src/config/nodemailer');
const { verifyCloudinaryConnection } = require('./src/config/cloudinary');
const { initSocket }            = require('./src/config/socket');  
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  connectRedis();
  await verifyEmailConnection();
  await verifyCloudinaryConnection();

  const httpServer = http.createServer(app);

  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Server started');
  });
};

startServer().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason }, 'Unhandled Promise Rejection');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  process.exit(1);
});