const crypto = require("crypto");
const Invoice = require("../models/invoice.model");
const ProcessedEvent = require("../models/processedEvent.model");
const AppError = require("../utils/AppError");
const logger = require("../config/logger");
const { getRazorpay } = require("../config/razorpay");
const { buildWorkspaceQuery } = require("../utils/queryHelpers");
const { invalidateDashboardCache } = require('./analytics.service');
const { createAuditLog } = require("./audit.service");
const {
  sendInvoiceEmail,
  sendPaymentConfirmationEmail,
  sendPaymentMismatchAlert,
} = require("./email.service");
const { generateAndUploadPDF } = require("./pdf.service");
const { markStepComplete } = require('./onboarding.service');


const sendInvoice = async (invoiceId, workspaceId, userId) => {
  const invoice = await Invoice.findOne(
    buildWorkspaceQuery({ _id: invoiceId }, workspaceId),
  )
    .populate("client", "name company email gstin")
    .populate("project", "title");

  if (!invoice)
    throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");

  if (invoice.status !== "draft") {
    throw new AppError(
      409,
      "INVOICE_NOT_DRAFT",
      `Invoice is already "${invoice.status}". Only draft invoices can be sent.`,
    );
  }

  const User = require("../models/user.model");
  const freelancer = await User.findById(userId);

  if (!invoice.pdfPublicId) {
    try {
      const { publicId, secureUrl } = await generateAndUploadPDF(
        invoice.toObject(),
        freelancer,
        invoice.client,
      );
      invoice.pdfUrl = secureUrl;
      invoice.pdfPublicId = publicId;
    } catch (err) {
      logger.warn(
        { err: err.message, invoiceId },
        "PDF generation failed during send — continuing",
      );
    }
  }

  const razorpay = getRazorpay();
  let razorpayLinkId = null;
  let razorpayLinkUrl = null;

  if (razorpay) {
    try {
      const amountInPaise = Math.round(invoice.grandTotal * 100);

      const paymentLink = await razorpay.paymentLink.create({
        amount: amountInPaise,
        currency: "INR",
        accept_partial: false, // Full payment only
        description: `Invoice ${invoice.invoiceNumber} from ${freelancer.name}`,
        customer: {
          name: invoice.client.name,
          email: invoice.client.email,
        },
        notify: {
          email: true, // Razorpay also sends its own email
        },
        reminder_enable: true,
        notes: {
          invoiceId: invoice._id.toString(),
          invoiceNumber: invoice.invoiceNumber,
          workspaceId: workspaceId.toString(),
        },
        callback_url: `${process.env.CLIENT_URL}/invoices/${invoice._id}/paid`,
        callback_method: "get",
      });

      razorpayLinkId = paymentLink.id;
      razorpayLinkUrl = paymentLink.short_url;

      logger.info(
        { invoiceId, razorpayLinkId, amount: amountInPaise },
        "Razorpay Payment Link created",
      );
    } catch (err) {
      logger.error(
        { err: err.message, invoiceId },
        "Razorpay Payment Link creation failed",
      );

      await createAuditLog({
        action: "PAYMENT_LINK_FAILED",
        workspaceId,
        userId,
        resource: { type: "invoice", id: invoice._id },
        metadata: { error: err.message, invoiceNumber: invoice.invoiceNumber },
      });

      throw new AppError(
        502,
        "PAYMENT_LINK_FAILED",
        "Failed to create payment link. Invoice remains as draft. Please try again.",
      );
    }
  }

  invoice.status = "sent";
  invoice.razorpayLinkId = razorpayLinkId;
  invoice.razorpayLinkUrl = razorpayLinkUrl;
  await invoice.save();
  await markStepComplete(userId, 'send_invoice');
  await invalidateDashboardCache(invoice.workspace.toString());

  await createAuditLog({
    action: "INVOICE_SENT",
    workspaceId,
    userId,
    resource: { type: "invoice", id: invoice._id },
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: invoice.grandTotal,
      razorpayLinkId,
      clientEmail: invoice.client.email,
    },
  });

  try {
    await sendInvoiceEmail(
      invoice,
      freelancer,
      invoice.client,
      razorpayLinkUrl,
    );
  } catch (err) {
    logger.warn(
      { err: err.message, invoiceId },
      "Client email failed after invoice sent",
    );
  }

  logger.info(
    { invoiceId, invoiceNumber: invoice.invoiceNumber },
    "Invoice sent",
  );
  return invoice;
};


const handleWebhook = async (rawBody, signature) => {

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    logger.warn("Razorpay webhook signature verification failed");
    throw new AppError(
      401,
      "INVALID_WEBHOOK_SIGNATURE",
      "Webhook signature invalid",
    );
  }

  const event = JSON.parse(rawBody.toString());

  logger.info({ eventId: event.id, event: event.event }, "Webhook received");

  const alreadyProcessed = await ProcessedEvent.findOne({ eventId: event.id });
  if (alreadyProcessed) {
    logger.info({ eventId: event.id }, "Duplicate webhook — ignored");
    return { status: "duplicate", message: "Event already processed" };
  }

  await ProcessedEvent.create({ eventId: event.id });

  switch (event.event) {
    case "payment_link.paid":
      await handlePaymentLinkPaid(event.payload);
      break;
    case "payment.captured":
      await handlePaymentCaptured(event.payload);
      break;
    case "payment.failed":
      await handlePaymentFailed(event.payload);
      break;
    default:
      logger.info(
        { event: event.event },
        "Unhandled webhook event type — ignored",
      );
  }

  return { status: "processed" };
};


const handlePaymentLinkPaid = async (payload) => {
  const paymentLink = payload.payment_link?.entity;
  if (!paymentLink) return;

  const invoiceId = paymentLink.notes?.invoiceId;
  if (!invoiceId) {
    logger.warn(
      { paymentLinkId: paymentLink.id },
      "No invoiceId in payment link notes",
    );
    return;
  }

  const paidAmountINR = paymentLink.amount_paid / 100; // Convert paise to INR

  await processPayment(
    invoiceId,
    paidAmountINR,
    paymentLink.id,
    "payment_link.paid",
  );
};


const handlePaymentCaptured = async (payload) => {
  const payment = payload.payment?.entity;
  if (!payment) return;

  const invoiceId = payment.notes?.invoiceId;
  if (!invoiceId) {
    logger.info(
      { paymentId: payment.id },
      "No invoiceId in payment notes — skipping",
    );
    return;
  }

  const paidAmountINR = payment.amount / 100;
  await processPayment(
    invoiceId,
    paidAmountINR,
    payment.id,
    "payment.captured",
  );
};


const processPayment = async (
  invoiceId,
  paidAmountINR,
  razorpayPaymentId,
  eventType,
) => {
  const invoice = await Invoice.findById(invoiceId).populate(
    "client",
    "name email",
  );

  if (!invoice) {
    logger.warn(
      { invoiceId, razorpayPaymentId },
      "Invoice not found for payment",
    );
    return;
  }

  if (invoice.status === "paid") {
    logger.info({ invoiceId }, "Invoice already paid — skipping");
    return;
  }

  const expectedAmount = invoice.grandTotal;
  const difference = Math.abs(paidAmountINR - expectedAmount);

  if (difference > 0.01) {
    logger.warn(
      {
        invoiceId,
        paidAmountINR,
        expectedAmount,
        difference,
        razorpayPaymentId,
      },
      "Payment amount mismatch",
    );

    await createAuditLog({
      action: "PAYMENT_AMOUNT_MISMATCH",
      workspaceId: invoice.workspace,
      resource: { type: "invoice", id: invoice._id },
      metadata: {
        paidAmountINR,
        expectedAmount,
        difference,
        razorpayPaymentId,
        eventType,
      },
    });

    try {
      const User = require("../models/user.model");
      const freelancer = await User.findById(invoice.uploadedBy);
      await sendPaymentMismatchAlert(invoice, paidAmountINR, expectedAmount);
    } catch (err) {
      logger.warn({ err: err.message }, "Failed to send mismatch alert email");
    }

    return; // Stop here — human review needed
  }

  invoice.status = "paid";
  invoice.paidAt = new Date();
  invoice.paidAmount = paidAmountINR;
  await invoice.save();
  await invalidateDashboardCache(invoice.workspace.toString());

  logger.info(
    { invoiceId, paidAmountINR, razorpayPaymentId },
    "Invoice marked as paid",
  );

  try {
    const { getIO } = require("../config/socket");
    const io = getIO();

    if (io) {
      const room = `workspace:${invoice.workspace}`;
      io.to(room).emit("invoice:paid", {
        invoiceId: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        paidAmount: paidAmountINR,
        clientName: invoice.client?.name || "Client",
        paidAt: invoice.paidAt,
      });

      logger.info({ room, invoiceId }, "invoice:paid event emitted");
    }
  } catch (err) {
    logger.warn({ err: err.message }, "Failed to emit invoice:paid event");
  }

  await createAuditLog({
    action: "PAYMENT_RECEIVED",
    workspaceId: invoice.workspace,
    resource: { type: "invoice", id: invoice._id },
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      paidAmountINR,
      razorpayPaymentId,
      eventType,
    },
  });

  try {
    await sendPaymentConfirmationEmail(invoice, invoice.client);
  } catch (err) {
    logger.warn(
      { err: err.message, invoiceId },
      "Payment confirmation email failed",
    );
  }
};


const handlePaymentFailed = async (payload) => {
  const payment = payload.payment?.entity;
  if (!payment) return;

  const invoiceId = payment.notes?.invoiceId;
  if (!invoiceId) return;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;

  if (!["sent", "viewed"].includes(invoice.status)) return;

  invoice.status = "payment_failed";
  await invoice.save();

  await createAuditLog({
    action: "INVOICE_OVERDUE",
    workspaceId: invoice.workspace,
    resource: { type: "invoice", id: invoice._id },
    metadata: {
      razorpayPaymentId: payment.id,
      errorCode: payment.error_code,
      errorDescription: payment.error_description,
    },
  });

  logger.info(
    { invoiceId, paymentId: payment.id },
    "Payment failed — invoice status updated",
  );
};


const markAsPaidManually = async (
  invoiceId,
  workspaceId,
  userId,
  razorpayPaymentId,
) => {
  const invoice = await Invoice.findOne(
    buildWorkspaceQuery({ _id: invoiceId }, workspaceId),
  );
  if (!invoice)
    throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");

  if (invoice.status === "paid") {
    throw new AppError(
      409,
      "INVOICE_ALREADY_PAID",
      "Invoice is already marked as paid",
    );
  }

  if (
    !["sent", "viewed", "payment_failed", "overdue"].includes(invoice.status)
  ) {
    throw new AppError(
      409,
      "INVOICE_CANNOT_BE_PAID",
      `Cannot mark a ${invoice.status} invoice as paid`,
    );
  }

  invoice.status = "paid";
  invoice.paidAt = new Date();
  invoice.paidAmount = invoice.grandTotal;
  invoice.manualPaymentNote =
    razorpayPaymentId || "Manual confirmation by freelancer";
  await invoice.save();
  await invalidateDashboardCache(workspaceId.toString());

  await createAuditLog({
    action: "MANUAL_PAYMENT_RECORDED",
    workspaceId,
    userId,
    resource: { type: "invoice", id: invoice._id },
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      paidAmount: invoice.grandTotal,
      razorpayPaymentId,
      markedBy: userId,
    },
  });

  logger.info({ invoiceId, userId }, "Invoice manually marked as paid");
  return invoice;
};

module.exports = {
  sendInvoice,
  handleWebhook,
  markAsPaidManually,
};
