const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
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
  portalToken:          { type: String, default: null },
  portalTokenExpiresAt: { type: Date,   default: null },

  isArchived: { type: Boolean, default: false, index: true }

}, { timestamps: true });

clientSchema.index(
  { workspace: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { isArchived: false },
    name: 'unique_active_email_per_workspace'
  }
);

clientSchema.index({ workspace: 1, createdAt: -1 });
clientSchema.index({ workspace: 1, isArchived: 1 });

module.exports = mongoose.model('Client', clientSchema);