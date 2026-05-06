const authService = require('../services/auth.service');
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const COOKIE_OPTIONS = {
  httpOnly: true,                                         
  secure:   process.env.NODE_ENV === 'production',        
  sameSite: 'strict',                                     
  maxAge:   7 * 24 * 60 * 60 * 1000                      
};

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json({ status: 'success', data: result });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.body);
  res.status(200).json({ status: 'success', data: result });
});

const login = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken, user } = await authService.login(req.body);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
  res.status(200).json({ status: 'success', data: { accessToken, user } });
});

const refresh = asyncHandler(async (req, res) => {
  const { accessToken, refreshToken } = await authService.refreshAccessToken(req.cookies.refreshToken);
  res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
  res.status(200).json({ status: 'success', data: { accessToken } });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies.refreshToken);
  res.clearCookie('refreshToken');
  res.status(200).json({ status: 'success', data: { message: 'Logged out' } });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email);
  res.status(200).json({ status: 'success', data: result });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { register, verifyEmail, login, refresh, logout, forgotPassword, resetPassword };