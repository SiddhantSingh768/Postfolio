const mongoose = require('mongoose');

const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'overdue'];

const milestoneSchema = new mongoose.Schema({
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

  deliverables: [{
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Deliverable'
  }],

  order: { type: Number, default: 0 },

  clientNote: { type: String, maxlength: 500, default: null }

}, { timestamps: true });

milestoneSchema.index({ project: 1, order: 1 });
milestoneSchema.index({ workspace: 1, status: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);