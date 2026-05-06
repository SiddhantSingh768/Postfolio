const mongoose = require('mongoose');

// Storing refresh tokens in their own collection (not as an array on User)
// makes revocation queries simpler: findOneAndUpdate({ token, isRevoked: false })
// vs pulling from an array and saving the whole User document.

const refreshTokenSchema = new mongoose.Schema({
  token:     { type: String, required: true, unique: true },
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  isRevoked: { type: Boolean, default: false },
}, { timestamps: true });

// TTL index: MongoDB automatically deletes expired token documents.
// This keeps the collection from growing forever.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1  });  // Fast lookup by user (for revoking all)

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);