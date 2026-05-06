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

    isEmailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, default: null },
    emailVerifyExpires: { type: Date, default: null },

    passwordResetToken: { type: String, default: null },
    passwordResetExpires: { type: Date, default: null },

    avatarUrl: { type: String, default: null },
    profile: {
      phone: { type: String, default: null },
      address: { type: String, default: null },
      gstin: { type: String, default: null },
    },

    invoiceSettings: {
      prefix: { type: String, default: "INV" },
      nextNumber: { type: Number, default: 1 },
      defaultDueDays: { type: Number, default: 30 },
    },
    onboarding: {
      hasAddedClient: { type: Boolean, default: false },
      hasCreatedProject: { type: Boolean, default: false },
      hasSentInvoice: { type: Boolean, default: false },
      isDismissed: { type: Boolean, default: false },
      completedAt: { type: Date, default: null },
    },

    oauthProvider: { type: String, default: null },
    oauthId: { type: String, default: null },

    isActive: { type: Boolean, default: true },
    onboardingCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = async function (candidate) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(candidate, this.passwordHash);
};

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
