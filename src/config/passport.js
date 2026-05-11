const passport      = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User          = require('../models/user.model');
const Workspace     = require('../models/workspace.model');
const logger        = require('./logger');

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email returned from Google'), null);
          }

          // Check if user already exists
          let user = await User.findOne({ email });

          if (user) {
            // Update OAuth fields if logging in with Google for first time
            if (!user.oauthProvider) {
              user.oauthProvider = 'google';
              user.oauthId       = profile.id;
              user.isEmailVerified = true;
              await user.save();
            }
            return done(null, user);
          }

          // Create new user from Google profile
          user = await User.create({
            name:            profile.displayName || email.split('@')[0],
            email,
            oauthProvider:   'google',
            oauthId:         profile.id,
            isEmailVerified: true,
            // No password — OAuth users don't need one
          });

          // Create workspace for new user
          const workspace = await Workspace.create({
            name:  `${user.name}'s Workspace`,
            owner: user._id,
            plan:  'solo',
          });

          user.defaultWorkspace = workspace._id;
          await user.save();

          logger.info({ userId: user._id }, 'New user created via Google OAuth');
          return done(null, user);

        } catch (err) {
          logger.error({ err: err.message }, 'Google OAuth strategy error');
          return done(err, null);
        }
      }
    )
  );

  logger.info('Google OAuth strategy registered');
} else {
  logger.warn('Google OAuth not configured — GOOGLE_CLIENT_ID missing. Google login disabled.');
}

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;