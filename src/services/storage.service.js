const { cloudinary } = require('../config/cloudinary');
const crypto         = require('crypto');
const logger         = require('../config/logger');
const AppError       = require('../utils/AppError');


const generateSignedUploadParams = (workspaceId, projectId, milestoneId) => {
  const timestamp = Math.round(Date.now() / 1000);

  const folder = `postfolio/${workspaceId}/${projectId}/${milestoneId}`;

  const paramsToSign = {
    timestamp,
    folder,
    upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
  };

  const signatureString = Object.keys(paramsToSign)
    .sort()
    .map(k => `${k}=${paramsToSign[k]}`)
    .join('&') + process.env.CLOUDINARY_API_SECRET;

  const signature = crypto
    .createHash('sha256')
    .update(signatureString)
    .digest('hex');

  return {
    signature,
    timestamp,
    folder,
    apiKey:      process.env.CLOUDINARY_API_KEY,
    cloudName:   process.env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
  };
};


const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok' && result.result !== 'not found') {
      logger.warn({ publicId, result }, 'Cloudinary delete returned unexpected result');
    }
    logger.info({ publicId }, 'File deleted from Cloudinary');
  } catch (err) {
    logger.warn({ err: err.message, publicId }, 'Failed to delete file from Cloudinary');
  }
};


const generateSignedUrl = (publicId, expiresInSeconds = 3600) => {
  return cloudinary.url(publicId, {
    sign_url:  true,
    type:      'authenticated',
    expires_at: Math.round(Date.now() / 1000) + expiresInSeconds,
    resource_type: 'auto',
  });
};


const fetchFileBuffer = async (publicId, resourceType = 'raw') => {
  try {
    const url    = cloudinary.url(publicId, {
      sign_url:      true,
      type:          'authenticated',
      resource_type: resourceType,
      expires_at:    Math.round(Date.now() / 1000) + 300, // 5 minute URL
    });

    const axios    = require('axios');
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    logger.warn({ err: err.message, publicId }, 'Failed to fetch file buffer');
    throw new AppError(500, 'FILE_FETCH_FAILED', `Could not fetch file: ${publicId}`);
  }
};

module.exports = {
  generateSignedUploadParams,
  deleteFile,
  generateSignedUrl,
  fetchFileBuffer,
};