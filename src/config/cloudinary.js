const cloudinary = require('cloudinary').v2;
const logger     = require('./logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const verifyCloudinaryConnection = async () => {
  try {
    await cloudinary.api.ping();
    logger.info('Cloudinary connected');
  } catch (err) {
    // Don't crash the server — warn and continue
    logger.warn({ err: err.message }, 'Cloudinary connection failed');
  }
};

module.exports = { cloudinary, verifyCloudinaryConnection };