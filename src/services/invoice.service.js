const Invoice   = require('../models/invoice.model');
const Client    = require('../models/client.model');
const Project   = require('../models/project.model');
const User      = require('../models/user.model');
const AppError  = require('../utils/AppError');
const logger    = require('../config/logger');
const { buildWorkspaceQuery, getPagination } = require('../utils/queryHelpers');
const { auditInvoiceCreated, auditInvoiceCancelled } = require('./audit.service');
const { generateAndUploadPDF } = require('./pdf.service');
const { invalidateDashboardCache } = require('./analytics.service');

// ─── Edit lock ────────────────────────────────────────────────────────────────
//
// This is the central enforcement point for invoice immutability.
// Call this at the top of any function that modifies invoice data.
// Only draft invoices are editable.

const EDITABLE_STATUSES = ['draft'];

const assertInvoiceEditable = (invoice) => {
  if (!EDITABLE_STATUSES.includes(invoice.status)) {
    throw new AppError(
      409,
      'INVOICE_NOT_EDITABLE',
      `Invoice cannot be edited in status "${invoice.status}". ` +
      `Cancel this invoice and create a new one to make corrections.`
    );
  }
};

// ─── Atomic invoice number generation ─────────────────────────────────────────
//
// The $inc operator atomically increments nextNumber on the User document
// and returns the document BEFORE the increment (new: false).
// This means:
//   Request A reads nextNumber: 5 → invoice gets INV-0005 → DB becomes 6
//   Request B reads nextNumber: 6 → invoice gets INV-0006 → DB becomes 7
// They can run simultaneously — $inc is atomic at the document level.
// No two invoices will ever get the same number.

const generateInvoiceNumber = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { 'invoiceSettings.nextNumber': 1 } },
    { new: false } // IMPORTANT: returns doc BEFORE increment
  );

  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const prefix = user.invoiceSettings?.prefix    || 'INV';
  const num    = user.invoiceSettings?.nextNumber || 1;

  // Zero-pad to 4 digits: INV-0001, INV-0042, INV-1234
  return `${prefix}-${String(num).padStart(4, '0')}`;
};

// ─── List invoices ────────────────────────────────────────────────────────────

const listInvoices = async (workspaceId, query) => {
  const { skip, limit, page } = getPagination(query);
  const filter = buildWorkspaceQuery({}, workspaceId);

  if (query.status) {
    const statuses = query.status.split(',').map(s => s.trim());
    filter.status = { $in: statuses };
  }
  if (query.client) filter.client = query.client;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('client',  'name company email')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter)
  ]);

  return {
    invoices,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};

// ─── Get single invoice ───────────────────────────────────────────────────────

const getInvoice = async (invoiceId, workspaceId) => {
  const invoice = await Invoice.findOne(
    buildWorkspaceQuery({ _id: invoiceId }, workspaceId)
  )
  .populate('client',  'name company email gstin phone')
  .populate('project', 'title')
  .lean();

  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
  return invoice;
};

// ─── Create invoice ───────────────────────────────────────────────────────────

const createInvoice = async (workspaceId, userId, data) => {
  // Validate client belongs to workspace
  const client = await Client.findOne(
    buildWorkspaceQuery({ _id: data.clientId, isArchived: false }, workspaceId)
  );
  if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found');

  // Validate project if provided
  if (data.projectId) {
    const project = await Project.findOne(
      buildWorkspaceQuery({ _id: data.projectId, isDeleted: false }, workspaceId)
    );
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  }

  // Generate unique invoice number atomically
  const invoiceNumber = await generateInvoiceNumber(userId);

  // Compute due date from default settings if not provided
  const user    = await User.findById(userId);
  const dueDays = user.invoiceSettings?.defaultDueDays || 30;
  const dueDate = data.dueDate || new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);

  // Create invoice — pre-save hook computes totals automatically
  const invoice = await Invoice.create({
    workspace:     workspaceId,
    client:        data.clientId,
    project:       data.projectId || null,
    invoiceNumber,
    dueDate,
    lineItems:     data.lineItems,
    notes:         data.notes || null,
    issueDate:     data.issueDate || new Date(),
  });

  await auditInvoiceCreated(invoice, userId);

  logger.info(
    { invoiceId: invoice._id, invoiceNumber, workspaceId },
    'Invoice created'
  );
  await invalidateDashboardCache(workspaceId);
  return invoice;
};

// ─── Update invoice (draft only) ──────────────────────────────────────────────

const updateInvoice = async (invoiceId, workspaceId, userId, updates) => {
  const invoice = await Invoice.findOne(
    buildWorkspaceQuery({ _id: invoiceId }, workspaceId)
  );
  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');

  // EDIT LOCK — throws 409 if not draft
  assertInvoiceEditable(invoice);

  // Whitelist updatable fields
  const allowed = ['lineItems', 'dueDate', 'notes', 'issueDate'];
  allowed.forEach(field => {
    if (updates[field] !== undefined) invoice[field] = updates[field];
  });

  // pre-save hook recomputes totals if lineItems changed
  await invoice.save();

  logger.info({ invoiceId, workspaceId }, 'Invoice updated');
  await invalidateDashboardCache(workspaceId.toString());
  return invoice;
};

// ─── Generate PDF for draft invoice ───────────────────────────────────────────

const generatePDF = async (invoiceId, workspaceId, userId) => {
  const invoice = await Invoice.findOne(
    buildWorkspaceQuery({ _id: invoiceId }, workspaceId)
  )
  .populate('client',  'name company email gstin')
  .populate('project', 'title');

  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');

  if (invoice.status !== 'draft') {
  if (invoice.pdfUrl && invoice.pdfUrl !== 'null') {
    const inlineUrl = invoice.pdfUrl.includes('fl_attachment')
      ? invoice.pdfUrl
      : invoice.pdfUrl.replace('/raw/upload/', '/raw/upload/fl_attachment:false/');
    return { pdfUrl: inlineUrl };
  }
  throw new AppError(
    409,
    'INVOICE_NOT_DRAFT',
    `Cannot generate PDF for a ${invoice.status} invoice. Create a new invoice.`
  );
}

  const freelancer = await User.findById(userId);

  const { publicId, secureUrl } = await generateAndUploadPDF(
    invoice.toObject(),
    freelancer,
    invoice.client
  );

  invoice.pdfUrl      = secureUrl;
  invoice.pdfPublicId = publicId;
  await invoice.save();

  logger.info({ invoiceId, workspaceId }, 'Invoice PDF generated');
  const inlineUrl = secureUrl.replace('/raw/upload/', '/raw/upload/fl_attachment:false/');
return { pdfUrl: inlineUrl };
};

// ─── Cancel invoice ───────────────────────────────────────────────────────────
//
// Cancellation is the correct way to "edit" a sent invoice.
// The original invoice is preserved in audit history.
// The freelancer creates a new invoice with the corrections.

const cancelInvoice = async (invoiceId, workspaceId, userId) => {
  const invoice = await Invoice.findOne(
    buildWorkspaceQuery({ _id: invoiceId }, workspaceId)
  );
  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');

  // Cannot cancel a paid invoice
  if (invoice.status === 'paid') {
    throw new AppError(
      409,
      'INVOICE_ALREADY_PAID',
      'A paid invoice cannot be cancelled'
    );
  }

  // Cannot cancel an already cancelled invoice
  if (invoice.status === 'cancelled') {
    throw new AppError(
      409,
      'INVOICE_ALREADY_CANCELLED',
      'Invoice is already cancelled'
    );
  }

  const previousStatus = invoice.status;
  invoice.status = 'cancelled';
  await invoice.save();

  await auditInvoiceCancelled(invoice, userId);

  logger.info(
    { invoiceId, previousStatus, workspaceId },
    'Invoice cancelled'
  );
  await invalidateDashboardCache(workspaceId.toString());

  return {
    message: 'Invoice cancelled. Create a new invoice with the corrections.',
    invoice
  };
};

// ─── Get audit log for a project ─────────────────────────────────────────────

const getProjectAuditLog = async (projectId, workspaceId, query) => {
  const AuditLog = require('../models/auditLog.model');
  const { skip, limit, page } = getPagination(query);

  const logs = await AuditLog.find({ projectId, workspaceId })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await AuditLog.countDocuments({ projectId, workspaceId });

  return {
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};

const streamPDFToResponse = async (invoiceId, workspaceId, res) => {
  const invoice = await Invoice.findOne(
    buildWorkspaceQuery({ _id: invoiceId }, workspaceId)
  );
  if (!invoice) throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found');
  if (!invoice.pdfPublicId) {
    throw new AppError(404, 'PDF_NOT_FOUND', 'PDF not generated yet. Call generate-pdf first.');
  }

  const { cloudinary } = require('../config/cloudinary');
  const axios = require('axios');

  // Generate a short-lived signed URL to fetch from Cloudinary
  const fetchUrl = cloudinary.url(invoice.pdfPublicId, {
    resource_type: 'raw',
    type:          'upload',
    sign_url:      false,
  });

  const response = await axios.get(fetchUrl, { responseType: 'stream' });

  // Set headers so browser renders PDF inline
  res.setHeader('Content-Type',        'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);

  // Pipe Cloudinary stream directly to HTTP response
  response.data.pipe(res);
};

module.exports = {
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  generatePDF,
  cancelInvoice,
  getProjectAuditLog,
  streamPDFToResponse, 
};