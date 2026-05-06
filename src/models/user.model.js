const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // null for OAuth-only users who never set a password
    passwordHash: { type: String, default: null },

    role: {
      type: String,
      enum: ["freelancer", "admin"],
      default: "freelancer",
    },
    defaultWorkspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },

    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, default: null }, // HASHED OTP — never raw
    emailVerifyExpires: { type: Date, default: null },

    // Password reset
    passwordResetToken: { type: String, default: null }, // HASHED token
    passwordResetExpires: { type: Date, default: null },

    // Profile (extended in later phases)
    avatarUrl: { type: String, default: null },
    profile: {
      phone: { type: String, default: null },
      address: { type: String, default: null },
      gstin: { type: String, default: null },
    },

    // Invoice settings — used from Phase 4 onward
    // nextNumber is incremented atomically via $inc — never read-then-write
    invoiceSettings: {
      prefix: { type: String, default: "INV" },
      nextNumber: { type: Number, default: 1 },
      defaultDueDays: { type: Number, default: 30 },
    },
    // Onboarding checklist state
    // Each field is set to true when the corresponding action is completed
    onboarding: {
      hasAddedClient: { type: Boolean, default: false },
      hasCreatedProject: { type: Boolean, default: false },
      hasSentInvoice: { type: Boolean, default: false },
      isDismissed: { type: Boolean, default: false },
      completedAt: { type: Date, default: null },
    },

    // OAuth
    oauthProvider: { type: String, default: null },
    oauthId: { type: String, default: null },

    isActive: { type: Boolean, default: true },
    onboardingCompleted: { type: Boolean, default: false }, // Controls checklist in Phase 7
  },
  { timestamps: true },
);

// Instance method: compare a plaintext password against the stored hash.
// Usage: const ok = await user.comparePassword('plaintextpass')
userSchema.methods.comparePassword = async function (candidate) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidate, this.passwordHash);
};

// Strip sensitive fields before returning user data in API responses.
// Call this before sending any user object to the client.
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.emailVerifyToken;
  delete obj.emailVerifyExpires;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
