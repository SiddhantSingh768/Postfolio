const invoiceService = require('../services/invoice.service');
const asyncHandler   = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const result = await invoiceService.listInvoices(req.workspaceId, req.query);
  res.status(200).json({ status: 'success', data: result });
});

const get = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoice(req.params.id, req.workspaceId);
  res.status(200).json({ status: 'success', data: { invoice } });
});

const create = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.createInvoice(
    req.workspaceId,
    req.user._id,
    req.body
  );
  res.status(201).json({ status: 'success', data: { invoice } });
});

const update = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoice(
    req.params.id,
    req.workspaceId,
    req.user._id,
    req.body
  );
  res.status(200).json({ status: 'success', data: { invoice } });
});

const generatePDF = asyncHandler(async (req, res) => {
  const result = await invoiceService.generatePDF(
    req.params.id,
    req.workspaceId,
    req.user._id
  );
  res.status(200).json({ status: 'success', data: result });
});

const cancel = asyncHandler(async (req, res) => {
  const result = await invoiceService.cancelInvoice(
    req.params.id,
    req.workspaceId,
    req.user._id
  );
  res.status(200).json({ status: 'success', data: result });
});

const getAuditLog = asyncHandler(async (req, res) => {
  const result = await invoiceService.getProjectAuditLog(
    req.params.projectId,
    req.workspaceId,
    req.query
  );
  res.status(200).json({ status: 'success', data: result });
});

// Add this — note: NOT using asyncHandler because we're piping a stream
const viewPDF = async (req, res, next) => {
  try {
    await invoiceService.streamPDFToResponse(
      req.params.id,
      req.workspaceId,
      res
    );
  } catch (err) {
    next(err);
  }
};


// Add these two imports at the top
const paymentService = require('../services/payment.service');

// Add these two controller functions
const send = asyncHandler(async (req, res) => {
  const invoice = await paymentService.sendInvoice(
    req.params.id,
    req.workspaceId,
    req.user._id
  );
  res.status(200).json({ status: 'success', data: { invoice } });
});

const markPaid = asyncHandler(async (req, res) => {
  const invoice = await paymentService.markAsPaidManually(
    req.params.id,
    req.workspaceId,
    req.user._id,
    req.body.razorpayPaymentId
  );
  res.status(200).json({ status: 'success', data: { invoice } });
});

// Update exports
module.exports = {
  list, get, create, update,
  generatePDF, cancel, getAuditLog,
  viewPDF, send, markPaid        // ← add send and markPaid
};