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

const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  qty:         { type: Number, required: true, min: 0.01 },
  unitPrice:   { type: Number, required: true, min: 0 },
  gstRate:     {
    type:    Number,
    enum:    GST_RATES,
    default: 18
  },
  amount: { type: Number, default: 0 }
}, { _id: false });

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

  subtotal:   { type: Number, default: 0 },
  totalGst:   { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },

  currency: { type: String, default: 'INR' },
  notes:    { type: String, maxlength: 1000, default: null },

  pdfUrl:   { type: String, default: null },
  pdfPublicId: { type: String, default: null }, 

  razorpayLinkId:  { type: String, default: null },
  razorpayLinkUrl: { type: String, default: null },

  paidAt:     { type: Date,   default: null },
  paidAmount: { type: Number, default: null },
  viewedAt:   { type: Date,   default: null },
  manualPaymentNote: { type: String, default: null }

}, { timestamps: true });


invoiceSchema.pre('save', function (next) {
  if (!this.isModified('lineItems')) return next();

  let subtotal = 0;
  let totalGst = 0;

  this.lineItems.forEach(item => {
    const itemAmount = Math.round(item.qty * item.unitPrice * 100) / 100;
    item.amount = itemAmount;

    const itemGst = Math.round(itemAmount * (item.gstRate / 100) * 100) / 100;

    subtotal += itemAmount;
    totalGst += itemGst;
  });

  this.subtotal   = Math.round(subtotal * 100) / 100;
  this.totalGst   = Math.round(totalGst * 100) / 100;
  this.grandTotal = Math.round((subtotal + totalGst) * 100) / 100;

  next();
});


invoiceSchema.index(
  { workspace: 1, invoiceNumber: 1 },
  { unique: true, name: 'unique_invoice_number_per_workspace' }
);

invoiceSchema.index({ workspace: 1, status: 1 });
invoiceSchema.index({ workspace: 1, client: 1 });
invoiceSchema.index({ workspace: 1, createdAt: -1 });
invoiceSchema.index({ workspace: 1, dueDate: 1 });

invoiceSchema.statics.getValidGstRates = () => GST_RATES;

module.exports = mongoose.model('Invoice', invoiceSchema);