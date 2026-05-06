const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  // workspace is the multi-tenancy key — every query must include this
  workspace: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Workspace',
    required: true,
    index:    true
  },

  name:    { type: String, required: true, trim: true, maxlength: 100 },
  company: { type: String, trim: true, maxlength: 100, default: null },
  email:   { type: String, required: true, trim: true, lowercase: true },
  phone:   { type: String, trim: true, default: null },
  country: { type: String, default: 'IN' },
  gstin:   { type: String, trim: true, default: null },
  notes:   { type: String, maxlength: 1000, default: null },

  // Portal access — generated in Phase 6
  portalToken:          { type: String, default: null },
  portalTokenExpiresAt: { type: Date,   default: null },

  // Soft delete — data preserved for invoice history
  // isArchived: true means the client is hidden from normal queries
  // but their invoices and projects remain intact
  isArchived: { type: Boolean, default: false, index: true }

}, { timestamps: true });

// ─── Compound Partial Index ───────────────────────────────────────────────────
//
// Problem this solves:
//   1. You archive client with email john@doe.com → isArchived: true
//   2. You try to add a new active client with john@doe.com
//   3. Without this index: MongoDB throws E11000 duplicate key error
//   4. With this index: only enforces uniqueness among NON-archived docs
//
// The partialFilterExpression makes the index ignore archived documents.
// So archived + active with the same email is allowed.
// Two active clients with the same email in the same workspace is blocked.
//
// The compound key includes workspace because two different freelancers
// can legitimately have clients with the same email address.
//
clientSchema.index(
  { workspace: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { isArchived: false },
    name: 'unique_active_email_per_workspace'
  }
);

// General workspace index for list queries
clientSchema.index({ workspace: 1, createdAt: -1 });
clientSchema.index({ workspace: 1, isArchived: 1 });

module.exports = mongoose.model('Client', clientSchema);