const mongoose = require('mongoose');

// Audit log is append-only.
// No document is ever updated or deleted.
// Every write operation in the system appends an entry here.

const AUDIT_ACTIONS = [
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
  'INVOICE_SENT',
  'INVOICE_VIEWED',
  'INVOICE_PAID',
  'INVOICE_CANCELLED',
  'INVOICE_OVERDUE',
  'PAYMENT_RECEIVED',
  'PAYMENT_AMOUNT_MISMATCH',
  'PAYMENT_LINK_FAILED',
  'DELIVERABLE_UPLOADED',
  'DELIVERABLE_DELETED',
  'PROJECT_STATUS_CHANGED',
  'CLIENT_ARCHIVED',
  'MANUAL_PAYMENT_RECORDED',
];

const auditLogSchema = new mongoose.Schema({
  timestamp: {
    type:    Date,
    default: Date.now,
    index:   true
  },

  actor: {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    role:      { type: String, default: 'freelancer' },
    ip:        { type: String, default: null },
    userAgent: { type: String, default: null }
  },

  action: {
    type:  String,
    enum:  AUDIT_ACTIONS,
    required: true,
    index: true
  },

  resource: {
    type: { type: String, default: null },  // 'invoice', 'project', 'deliverable'
    id:   { type: mongoose.Schema.Types.ObjectId, default: null }
  },

  workspaceId: {
    type:  mongoose.Schema.Types.ObjectId,
    ref:   'Workspace',
    index: true
  },

  projectId: {
    type:  mongoose.Schema.Types.ObjectId,
    ref:   'Project',
    default: null,
    index: true
  },

  // Action-specific data: old value, new value, amounts, etc.
  metadata: {
    type:    mongoose.Schema.Types.Mixed,
    default: {}
  }

// Note: no timestamps option — we manage timestamp manually
// so it's always UTC and queryable as a Date field
});

// Compound index for querying audit log per workspace + action type
auditLogSchema.index({ workspaceId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ workspaceId: 1, 'resource.id': 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);