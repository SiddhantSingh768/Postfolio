const mongoose = require('mongoose');

// These are the ONLY valid project statuses.
// The state machine in project.service.js enforces
// which transitions between these are allowed.
const PROJECT_STATUSES = ['draft', 'active', 'on_hold', 'completed', 'cancelled'];

const projectSchema = new mongoose.Schema({
  workspace: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Workspace',
    required: true,
    index:    true
  },
  client: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Client',
    required: true,
    index:    true
  },

  title:       { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, maxlength: 2000, default: null },
  status:      { type: String, enum: PROJECT_STATUSES, default: 'draft', index: true },

  startDate: { type: Date, default: null },
  endDate:   { type: Date, default: null },   // Expected completion date
  budget:    { type: Number, min: 0, default: null }, // INR

  // Array of Milestone ObjectIds — populated on demand
  milestones: [{
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Milestone'
  }],

  tags: [{ type: String, trim: true }],

  // Portal — managed in Phase 6
  portalEnabled:        { type: Boolean, default: false },
  portalToken:          { type: String, default: null },
  portalTokenExpiresAt: { type: Date,   default: null },

  // Whether to email client on milestone completion
  notifyClient: { type: Boolean, default: true },

  // Soft delete — only draft projects can be deleted
  isDeleted:   { type: Boolean, default: false },
  deletedAt:   { type: Date, default: null }

}, { timestamps: true });

projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ workspace: 1, client: 1 });
projectSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);