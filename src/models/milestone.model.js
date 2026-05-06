const mongoose = require('mongoose');

const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'overdue'];

const milestoneSchema = new mongoose.Schema({
  // Both workspace and project are indexed for efficient querying
  workspace: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Workspace',
    required: true,
    index:    true
  },
  project: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Project',
    required: true,
    index:    true
  },

  title:       { type: String, required: true, trim: true },
  description: { type: String, default: null },
  status:      { type: String, enum: MILESTONE_STATUSES, default: 'pending' },

  dueDate:     { type: Date, default: null },
  completedAt: { type: Date, default: null },

  // Deliverable ObjectIds — populated in Phase 3
  deliverables: [{
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Deliverable'
  }],

  // Display order within the project (1-based)
  order: { type: Number, default: 0 },

  // Approval comment from client via portal (Phase 6)
  clientNote: { type: String, maxlength: 500, default: null }

}, { timestamps: true });

milestoneSchema.index({ project: 1, order: 1 });
milestoneSchema.index({ workspace: 1, status: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);