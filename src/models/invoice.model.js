const mongoose = require('mongoose');

const INVOICE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'payment_failed',
  'cancelled'
];

const GST_RATES = [0, 5, 12, 18, 28];

// Line item schema — each row in the invoice table
const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  qty:         { type: Number, required: true, min: 0.01 },
  unitPrice:   { type: Number, required: true, min: 0 },
  gstRate:     {
    type:    Number,
    enum:    GST_RATES,
    default: 18
  },
  // amount is computed by the pre-save hook — never set manually
  amount: { type: Number, default: 0 }
}, { _id: false }); // No _id on subdocuments

const invoiceSchema = new mongoose.Schema({
  workspace: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Workspace',
    required: true,
    index:    true
  },
  client: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Client',
    required: true
  },
  project: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Project',
    default:  null
  },

  invoiceNumber: {
    type:     String,
    required: true
    // Unique per workspace enforced by compound index below
  },

  status: {
    type:    String,
    enum:    INVOICE_STATUSES,
    default: 'draft',
    index:   true
  },

  issueDate: { type: Date, default: Date.now },
  dueDate:   { type: Date, required: true },

  lineItems: {
    type:     [lineItemSchema],
    validate: {
      validator: (items) => items.length > 0,
      message:   'Invoice must have at least one line item'
    }
  },

  // These three are computed by the pre-save hook
  // Never set them manually — they will be overwritten
  subtotal:   { type: Number, default: 0 },
  totalGst:   { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  currency: { type: String, default: 'INR' },
  notes:    { type: String, maxlength: 1000, default: null },

  // PDF — populated after invoice.send() in Phase 5
  pdfUrl:   { type: String, default: null },
  pdfPublicId: { type: String, default: null }, 

  // Razorpay — populated in Phase 5
  razorpayLinkId:  { type: String, default: null },
  razorpayLinkUrl: { type: String, default: null },

  // Payment tracking
  paidAt:     { type: Date,   default: null },
  paidAmount: { type: Number, default: null },
  viewedAt:   { type: Date,   default: null },

  // Manual payment fallback (when webhook doesn't arrive)
  manualPaymentNote: { type: String, default: null }

}, { timestamps: true });

// ─── Pre-save hook: GST computation ──────────────────────────────────────────
//
// This runs automatically before every invoice.save().
// It recomputes all financial totals from the line items.
//
// Why a pre-save hook instead of computing in the service?
//   1. Totals are ALWAYS consistent — no chance of a service forgetting to compute
//   2. Directly editing a line item and saving will auto-recompute
//   3. The hook only runs when lineItems is modified (isModified check)
//
// GST computation rules:
//   lineItem.amount  = qty * unitPrice (before GST)
//   lineItem GST     = amount * (gstRate / 100)
//   subtotal         = sum of all lineItem.amounts
//   totalGst         = sum of all lineItem GST amounts
//   grandTotal       = subtotal + totalGst
//
// Amounts are rounded to 2 decimal places to avoid floating-point issues
// e.g. 0.1 + 0.2 = 0.30000000000000004 in JavaScript

invoiceSchema.pre('save', function (next) {
  // Only recompute if lineItems were modified
  // Avoids unnecessary computation on status-only updates
  if (!this.isModified('lineItems')) return next();

  let subtotal = 0;
  let totalGst = 0;

  this.lineItems.forEach(item => {
    // Base amount (before GST)
    const itemAmount = Math.round(item.qty * item.unitPrice * 100) / 100;
    item.amount = itemAmount;

    // GST on this line item
    const itemGst = Math.round(itemAmount * (item.gstRate / 100) * 100) / 100;

    subtotal += itemAmount;
    totalGst += itemGst;
  });

  this.subtotal   = Math.round(subtotal * 100) / 100;
  this.totalGst   = Math.round(totalGst * 100) / 100;
  this.grandTotal = Math.round((subtotal + totalGst) * 100) / 100;

  next();
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

// Unique invoice number per workspace
invoiceSchema.index(
  { workspace: 1, invoiceNumber: 1 },
  { unique: true, name: 'unique_invoice_number_per_workspace' }
);

invoiceSchema.index({ workspace: 1, status: 1 });
invoiceSchema.index({ workspace: 1, client: 1 });
invoiceSchema.index({ workspace: 1, createdAt: -1 });
invoiceSchema.index({ workspace: 1, dueDate: 1 }); // For overdue queries

// Export GST_RATES so routes can use it for validation
invoiceSchema.statics.getValidGstRates = () => GST_RATES;

module.exports = mongoose.model('Invoice', invoiceSchema);