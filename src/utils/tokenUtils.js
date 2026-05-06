const jwt    = require('jsonwebtoken');
const crypto = require('crypto'); // Built into Node — no install needed

// ─── Access & refresh tokens ──────────────────────────────────────────────────

const generateAccessToken = (userId, workspaceId, role) =>
  jwt.sign(
    { userId, workspaceId, role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES }
  );

const generateRefreshToken = (userId) =>
  jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES }
  );

// Both throw JsonWebTokenError or TokenExpiredError if invalid.
// The global error handler catches these and returns 401.
const verifyAccessToken  = (token) => jwt.verify(token, process.env.JWT_ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, process.env.JWT_REFRESH_SECRET);

// ─── OTP (email verification) ─────────────────────────────────────────────────

// crypto.randomInt is cryptographically secure — Math.random() is NOT.
const generateOTP = () => crypto.randomInt(100000, 999999).toString();

// Never store raw OTPs. Store the hash, compare hashes.
const hashOTP = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// ─── HMAC portal tokens (used in Phase 6, built here) ────────────────────────

const generatePortalToken = (workspaceId, projectId, expiresInDays = 30) => {
  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const payload   = Buffer.from(JSON.stringify({ workspaceId, projectId, expiresAt }))
                          .toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.PORTAL_TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
};

const verifyPortalToken = (token, expectedWorkspaceId, expectedProjectId) => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new Error('Malformed token');

  const expectedSig    = crypto
    .createHmac('sha256', process.env.PORTAL_TOKEN_SECRET)
    .update(payload)
    .digest('base64url');

  // timingSafeEqual prevents timing attacks where an attacker
  // measures response time to guess the correct signature byte-by-byte
  const a = Buffer.from(signature,    'base64url');
  const b = Buffer.from(expectedSig,  'base64url');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid signature');
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (Date.now() > data.expiresAt)              throw new Error('Token expired');
  if (data.workspaceId !== expectedWorkspaceId) throw new Error('Workspace mismatch');
  if (data.projectId   !== expectedProjectId)   throw new Error('Project mismatch');
  return data;
};

module.exports = {
  generateAccessToken, generateRefreshToken,
  verifyAccessToken,   verifyRefreshToken,
  generateOTP,         hashOTP,
  generatePortalToken, verifyPortalToken,
};