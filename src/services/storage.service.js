const { cloudinary } = require('../config/cloudinary');
const crypto         = require('crypto');
const logger         = require('../config/logger');
const AppError       = require('../utils/AppError');

// ─── Generate signed upload parameters ───────────────────────────────────────
//
// How the upload flow works:
//
// 1. Frontend calls POST /api/v1/deliverables/sign-upload
// 2. Server generates a signature using the Cloudinary API secret
// 3. Frontend uses the signature to upload DIRECTLY to Cloudinary
//    (file never touches your server)
// 4. Cloudinary returns a public_id and secure_url
// 5. Frontend sends public_id and secure_url to your server
// 6. Server creates the Deliverable document in MongoDB
//
// Why this approach?
//   - Server stays stateless (no multipart parsing, no temp files)
//   - Works for large files without memory issues
//   - API secret is never exposed to the browser

const generateSignedUploadParams = (workspaceId, projectId, milestoneId) => {
  const timestamp = Math.round(Date.now() / 1000);

  // folder organises files in Cloudinary by workspace/project/milestone
  const folder = `postfolio/${workspaceId}/${projectId}/${milestoneId}`;

  // Parameters that must be signed — must match exactly what the client sends
  const paramsToSign = {
    timestamp,
    folder,
    upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
  };

  // Generate HMAC-SHA256 signature
  // Cloudinary verifies this on their end — rejects uploads without valid sig
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

// ─── Delete a file from Cloudinary ───────────────────────────────────────────
//
// publicId is stored on the Deliverable document.
// Called when a deliverable is deleted (not on version supersession —
// old versions are kept in Cloudinary for audit purposes).

const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result !== 'ok' && result.result !== 'not found') {
      logger.warn({ publicId, result }, 'Cloudinary delete returned unexpected result');
    }
    logger.info({ publicId }, 'File deleted from Cloudinary');
  } catch (err) {
    // Log but don't throw — a failed Cloudinary delete shouldn't
    // roll back a successful DB operation
    logger.warn({ err: err.message, publicId }, 'Failed to delete file from Cloudinary');
  }
};

// ─── Generate a signed URL for secure file access ────────────────────────────
//
// Cloudinary files can be public or private.
// For deliverables, we store them privately and generate
// short-lived signed URLs when a client or freelancer requests access.
// This prevents unauthorised direct access via the Cloudinary URL.

const generateSignedUrl = (publicId, expiresInSeconds = 3600) => {
  return cloudinary.url(publicId, {
    sign_url:  true,
    type:      'authenticated',
    expires_at: Math.round(Date.now() / 1000) + expiresInSeconds,
    resource_type: 'auto',
  });
};

// ─── Fetch file as buffer (for ZIP streaming) ────────────────────────────────
//
// Used in the bulk ZIP download endpoint.
// Fetches the raw bytes of a file from Cloudinary.

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