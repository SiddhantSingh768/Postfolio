const bcrypt       = require('bcryptjs');
const crypto       = require('crypto');
const User         = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');
const AppError     = require('../utils/AppError');
const logger       = require('../config/logger');
const {
  generateAccessToken, generateRefreshToken,
  verifyRefreshToken,  generateOTP, hashOTP
}                  = require('../utils/tokenUtils');
const { createSoloWorkspace }  = require('./workspace.service');
const { sendOTPEmail, sendPasswordResetEmail } = require('./email.service');


const register = async ({ name, email, password }) => {
  const existing = await User.findOne({ email });
  if (existing) throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const otp          = generateOTP();
  const hashedOTP    = hashOTP(otp);

  const user = await User.create({
    name,
    email,
    passwordHash,
    emailVerifyToken:   hashedOTP,
    emailVerifyExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    isEmailVerified:    false
  });

  const workspace       = await createSoloWorkspace(user._id, user.name);
  user.defaultWorkspace = workspace._id;
  await user.save();

  await sendOTPEmail(email, name, otp);

  logger.info({ userId: user._id }, 'User registered');
  return { message: 'Registration successful. Check your email for the verification code.' };
};


const verifyEmail = async ({ email, otp }) => {
  const user = await User.findOne({ email });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'No account found with this email');
  if (user.isEmailVerified) throw new AppError(400, 'ALREADY_VERIFIED', 'Email is already verified');

  if (!user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
    throw new AppError(400, 'OTP_EXPIRED', 'Code has expired. Request a new one.');
  }
  if (hashOTP(otp) !== user.emailVerifyToken) {
    throw new AppError(400, 'INVALID_OTP', 'Incorrect verification code');
  }

  user.isEmailVerified    = true;
  user.emailVerifyToken   = null;
  user.emailVerifyExpires = null;
  await user.save();

  logger.info({ userId: user._id }, 'Email verified');
  return { message: 'Email verified. You can now log in.' };
};


const login = async ({ email, password }) => {
  const user = await User.findOne({ email });

  if (!user || !user.isActive) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!user.isEmailVerified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

  const accessToken  = generateAccessToken(user._id, user.defaultWorkspace, user.role);
  const refreshToken = generateRefreshToken(user._id);

  await RefreshToken.create({
    token:     refreshToken,
    user:      user._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  logger.info({ userId: user._id }, 'User logged in');
  return { accessToken, refreshToken, user: user.toSafeObject() };
};


const refreshAccessToken = async (incomingToken) => {
  if (!incomingToken) throw new AppError(401, 'NO_REFRESH_TOKEN', 'Refresh token required');

  let decoded;
  try {
    decoded = verifyRefreshToken(incomingToken);
  } catch {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }

  const stored = await RefreshToken.findOne({
    token:     incomingToken,
    user:      decoded.userId,
    isRevoked: false
  });

  if (!stored) {
    await RefreshToken.updateMany({ user: decoded.userId }, { isRevoked: true });
    logger.warn({ userId: decoded.userId }, 'Refresh token reuse detected — all tokens revoked');
    throw new AppError(401, 'TOKEN_REUSE_DETECTED', 'Session invalidated for security. Please log in again.');
  }

  stored.isRevoked = true;
  await stored.save();

  const user       = await User.findById(decoded.userId);
  const newAccess  = generateAccessToken(user._id, user.defaultWorkspace, user.role);
  const newRefresh = generateRefreshToken(user._id);

  await RefreshToken.create({
    token:     newRefresh,
    user:      user._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return { accessToken: newAccess, refreshToken: newRefresh };
};


const logout = async (refreshToken) => {
  if (refreshToken) {
    await RefreshToken.findOneAndUpdate({ token: refreshToken }, { isRevoked: true });
  }
  return { message: 'Logged out successfully' };
};


const forgotPassword = async (email) => {
  const user = await User.findOne({ email });

  if (!user) {
    return { message: 'If an account exists with that email, a reset link has been sent.' };
  }

  const rawToken    = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.passwordResetToken   = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  try {
    await sendPasswordResetEmail(email, user.name, rawToken);
  } catch (err) {
    user.passwordResetToken   = null;
    user.passwordResetExpires = null;
    await user.save();
    throw new AppError(500, 'EMAIL_SEND_FAILED', 'Failed to send reset email. Please try again.');
  }

  return { message: 'If an account exists with that email, a reset link has been sent.' };
};


const resetPassword = async ({ token, newPassword }) => {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken:   hashedToken,
    passwordResetExpires: { $gt: new Date() } // Still within the 1-hour window
  });

  if (!user) throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid or has expired');

  user.passwordHash         = await bcrypt.hash(newPassword, 12);
  user.passwordResetToken   = null;
  user.passwordResetExpires = null;
  await user.save();

  await RefreshToken.updateMany({ user: user._id }, { isRevoked: true });

  logger.info({ userId: user._id }, 'Password reset');
  return { message: 'Password reset successful. Please log in with your new password.' };
};

module.exports = {
  register, verifyEmail, login,
  refreshAccessToken, logout,
  forgotPassword, resetPassword
};