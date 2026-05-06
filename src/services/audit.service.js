const AuditLog = require('../models/auditLog.model');
const logger   = require('../config/logger');


const createAuditLog = async ({
  action,
  workspaceId,
  userId    = null,
  projectId = null,
  resource  = null,
  metadata  = {},
  ip        = null,
  userAgent = null,
}) => {
  try {
    await AuditLog.create({
      action,
      workspaceId,
      projectId,
      resource,
      metadata,
      actor: { userId, role: 'freelancer', ip, userAgent }
    });
  } catch (err) {
    logger.warn({ err: err.message, action }, 'Audit log write failed');
  }
};

const auditInvoiceCreated = (invoice, userId) =>
  createAuditLog({
    action:      'INVOICE_CREATED',
    workspaceId: invoice.workspace,
    userId,
    resource:    { type: 'invoice', id: invoice._id },
    metadata:    { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal }
  });

const auditInvoiceSent = (invoice, userId) =>
  createAuditLog({
    action:      'INVOICE_SENT',
    workspaceId: invoice.workspace,
    userId,
    resource:    { type: 'invoice', id: invoice._id },
    metadata:    { invoiceNumber: invoice.invoiceNumber, grandTotal: invoice.grandTotal }
  });

const auditInvoiceCancelled = (invoice, userId) =>
  createAuditLog({
    action:      'INVOICE_CANCELLED',
    workspaceId: invoice.workspace,
    userId,
    resource:    { type: 'invoice', id: invoice._id },
    metadata:    { invoiceNumber: invoice.invoiceNumber, reason: 'manual_cancel' }
  });

const auditProjectStatusChanged = (project, fromStatus, toStatus, userId) =>
  createAuditLog({
    action:      'PROJECT_STATUS_CHANGED',
    workspaceId: project.workspace,
    userId,
    projectId:   project._id,
    resource:    { type: 'project', id: project._id },
    metadata:    { from: fromStatus, to: toStatus }
  });

module.exports = {
  createAuditLog,
  auditInvoiceCreated,
  auditInvoiceSent,
  auditInvoiceCancelled,
  auditProjectStatusChanged,
};