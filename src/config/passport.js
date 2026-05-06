const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User           = require('../models/user.model');
const { createSoloWorkspace } = require('../services/workspace.service');
const logger = require('./logger');

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  '/api/v1/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ oauthProvider: 'google', oauthId: profile.id });
      if (user) return done(null, user);

      user = await User.findOne({ email: profile.emails[0].value });
      if (user) {
        user.oauthProvider = 'google';
        user.oauthId       = profile.id;
        if (!user.avatarUrl) user.avatarUrl = profile.photos?.[0]?.value || null;
        await user.save();
        return done(null, user);
      }

      user = await User.create({
        name:            profile.displayName,
        email:           profile.emails[0].value,
        isEmailVerified: true,  // Google already verified the email
        oauthProvider:   'google',
        oauthId:         profile.id,
        avatarUrl:       profile.photos?.[0]?.value || null
      });

      const workspace       = await createSoloWorkspace(user._id, user.name);
      user.defaultWorkspace = workspace._id;
      await user.save();

      logger.info({ userId: user._id }, 'New user via Google OAuth');
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

module.exports = passport;