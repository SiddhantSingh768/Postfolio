const express         = require('express');
const { body }        = require('express-validator');
const asyncHandler    = require('../utils/asyncHandler');
const router          = express.Router();
const authCtrl        = require('../controllers/auth.controller');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter.middleware');
const validateRequest = require('../middleware/validateRequest');
const passport     = require('../config/passport');
const RefreshToken = require('../models/refreshToken.model');
const { generateAccessToken, generateRefreshToken } = require('../utils/tokenUtils');
const { protect } = require('../middleware/auth.middleware');
const workspaceScope = require('../middleware/workspaceScope');

router.get('/me', protect, (req, res) => {
  res.status(200).json({
    status: 'success',
    data:   { user: req.user.toSafeObject() }
  });
});

router.patch('/profile', protect, asyncHandler(async (req, res) => {
  const User    = require('../models/user.model');
  const allowed = ['name', 'profile', 'invoiceSettings', 'avatarUrl'];
  const updates = {};
  allowed.forEach(f => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data:   { user: user.toSafeObject() }
  });
}));


const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Minimum 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Must contain uppercase, lowercase, and a number'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
];


const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000
};

router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const user         = req.user;
      const accessToken  = generateAccessToken(user._id, user.defaultWorkspace, user.role);
      const refreshToken = generateRefreshToken(user._id);

      await RefreshToken.create({
        token:     refreshToken,
        user:      user._id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
      res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${accessToken}`);
    } catch (err) {
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }
  }
);



router.post('/register',        registerLimiter, registerRules, validateRequest, authCtrl.register);
router.post('/verify-email',    [body('email').isEmail(), body('otp').isLength({ min: 6, max: 6 }).isNumeric()], validateRequest, authCtrl.verifyEmail);
router.post('/login',           loginLimiter, loginRules, validateRequest, authCtrl.login);
router.post('/refresh',         authCtrl.refresh);
router.post('/logout',          authCtrl.logout);
router.post('/forgot-password', [body('email').isEmail().normalizeEmail()], validateRequest, authCtrl.forgotPassword);
router.post('/reset-password',  [body('token').notEmpty(), body('newPassword').isLength({ min: 8 })], validateRequest, authCtrl.resetPassword);

module.exports = router;