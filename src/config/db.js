const mongoose = require('mongoose');
const logger   = require('./logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    logger.info({ host: conn.connection.host }, 'MongoDB connected');
  } catch (err) {
    logger.fatal({ err }, 'MongoDB connection failed');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'development') {
    try {
      await mongoose.syncIndexes();
      logger.info('MongoDB indexes synced');
    } catch (err) {
      logger.warn({ err }, 'Failed to sync MongoDB indexes');
    }
  }
};

module.exports = connectDB;