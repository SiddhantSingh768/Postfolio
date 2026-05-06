const mongoose = require('mongoose');

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
  endDate:   { type: Date, default: null },
  budget:    { type: Number, min: 0, default: null }, 

  milestones: [{
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Milestone'
  }],

  tags: [{ type: String, trim: true }],

  portalEnabled:        { type: Boolean, default: false },
  portalToken:          { type: String, default: null },
  portalTokenExpiresAt: { type: Date,   default: null },

  notifyClient: { type: Boolean, default: true },

  isDeleted:   { type: Boolean, default: false },
  deletedAt:   { type: Date, default: null }

}, { timestamps: true });

projectSchema.index({ workspace: 1, status: 1 });
projectSchema.index({ workspace: 1, client: 1 });
projectSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);