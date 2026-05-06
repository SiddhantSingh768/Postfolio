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

// ─── Send invoice ─────────────────────────────────────────────────────────────
//
// This is the most complex function in the entire backend.
// It does five things atomically-ish:
// 1. Generates the PDF
// 2. Creates a Razorpay Payment Link
// 3. Locks the invoice (status: sent)
// 4. Emails the client
// 5. Writes audit log
//
// If Razorpay fails, the invoice rolls back to draft.
// If email fails, we log and continue — invoice is still sent.

const sendInvoice = async (invoiceId, workspaceId, userId) => {
  // Fetch full invoice with populated fields
  const invoice = await Invoice.findOne(
    buildWorkspaceQuery({ _id: invoiceId }, workspaceId),
  )
    .populate("client", "name company email gstin")
    .populate("project", "title");

  if (!invoice)
    throw new AppError(404, "INVOICE_NOT_FOUND", "Invoice not found");

  // Only draft invoices can be sent
  if (invoice.status !== "draft") {
    throw new AppError(
      409,
      "INVOICE_NOT_DRAFT",
      `Invoice is already "${invoice.status}". Only draft invoices can be sent.`,
    );
  }

  const User = require("../models/user.model");
  const freelancer = await User.findById(userId);

  // ── Step 1: Generate PDF if not already done ─────────────────────────────
  if (!invoice.pdfPublicId) {
    try {
      const { publicId, secureUrl } = await generateAndUploadPDF(
        invoice.toObject(),
        freelancer,
        invoice.client,
      );
      invoice.pdfUrl = secureUrl;
      invoice.pdfPublicId = publicId;
      // Don't save yet — save everything together after Razorpay succeeds
    } catch (err) {
      logger.warn(
        { err: err.message, invoiceId },
        "PDF generation failed during send — continuing",
      );
      // PDF failure doesn't block sending — client can download later
    }
  }

  // ── Step 2: Create Razorpay Payment Link ──────────────────────────────────
  const razorpay = getRazorpay();
  let razorpayLinkId = null;
  let razorpayLinkUrl = null;

  if (razorpay) {
    try {
      // Razorpay amounts are in paise (1 INR = 100 paise)
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
          email: true, // Razorpay also sends its own email — belt and suspenders
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
      // ── ROLLBACK: Razorpay failed — invoice stays draft ─────────────────
      // Do NOT change invoice status. Return error to freelancer.
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

  // ── Step 3: Lock the invoice ──────────────────────────────────────────────
  // Everything above succeeded — now commit all changes
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

  // ── Step 4: Email the client ──────────────────────────────────────────────
  // Email failure does NOT roll back the invoice — it's already sent
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
    // Freelancer can manually share the payment link from the dashboard
  }

  logger.info(
    { invoiceId, invoiceNumber: invoice.invoiceNumber },
    "Invoice sent",
  );
  return invoice;
};

// ─── Handle Razorpay webhook ──────────────────────────────────────────────────
//
// This function is called from the webhook route.
// rawBody is the Buffer from express.raw() — needed for signature verification.

const handleWebhook = async (rawBody, signature) => {
  // ── Step 1: Verify HMAC signature ─────────────────────────────────────────
  // Razorpay signs the raw body with your webhook secret using HMAC-SHA256.
  // If the signature doesn't match, the request is not from Razorpay.
  // We must verify BEFORE doing any database operations.

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  // timingSafeEqual prevents timing attacks
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

  // Parse the body now that we know it's legitimate
  const event = JSON.parse(rawBody.toString());

  logger.info({ eventId: event.id, event: event.event }, "Webhook received");

  // ── Step 2: Idempotency check ──────────────────────────────────────────────
  // Razorpay retries webhooks if your server doesn't respond with 200 quickly.
  // This check prevents processing the same event twice.
  const alreadyProcessed = await ProcessedEvent.findOne({ eventId: event.id });
  if (alreadyProcessed) {
    logger.info({ eventId: event.id }, "Duplicate webhook — ignored");
    return { status: "duplicate", message: "Event already processed" };
  }

  // Record this event BEFORE processing
  // If processing fails, the event won't be recorded and can be retried
  await ProcessedEvent.create({ eventId: event.id });

  // ── Step 3: Route to correct handler ──────────────────────────────────────
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

// ─── Payment link paid ────────────────────────────────────────────────────────

const handlePaymentLinkPaid = async (payload) => {
  const paymentLink = payload.payment_link?.entity;
  if (!paymentLink) return;

  // Extract invoiceId from the notes we set when creating the link
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

// ─── Payment captured ─────────────────────────────────────────────────────────

const handlePaymentCaptured = async (payload) => {
  const payment = payload.payment?.entity;
  if (!payment) return;

  // Try to find invoice via payment link notes
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

// ─── Core payment processing ──────────────────────────────────────────────────
//
// This is called by both handlePaymentLinkPaid and handlePaymentCaptured.
// It contains the amount reconciliation logic.

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

  // Skip if already paid — idempotency at the business level
  if (invoice.status === "paid") {
    logger.info({ invoiceId }, "Invoice already paid — skipping");
    return;
  }

  // ── Amount reconciliation ─────────────────────────────────────────────────
  // Compare what Razorpay says was paid vs what the invoice total is.
  // Allow 1 paisa tolerance for floating point rounding.
  const expectedAmount = invoice.grandTotal;
  const difference = Math.abs(paidAmountINR - expectedAmount);

  if (difference > 0.01) {
    // MISMATCH — do NOT mark as paid
    // Flag for manual review and alert the freelancer
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

  // ── Mark invoice as paid ──────────────────────────────────────────────────
  invoice.status = "paid";
  invoice.paidAt = new Date();
  invoice.paidAmount = paidAmountINR;
  await invoice.save();
  await invalidateDashboardCache(invoice.workspace.toString());

  logger.info(
    { invoiceId, paidAmountINR, razorpayPaymentId },
    "Invoice marked as paid",
  );

  // ── Emit real-time event to freelancer dashboard ──────────────────────────
  // This is the only Socket.io emit in v1.
  // The freelancer's React dashboard listens for this event
  // and invalidates the React Query cache — no page refresh needed.
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
    // Socket.io emit failure must never crash the payment flow
    logger.warn({ err: err.message }, "Failed to emit invoice:paid event");
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
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

  // ── Notify both parties ───────────────────────────────────────────────────
  try {
    await sendPaymentConfirmationEmail(invoice, invoice.client);
  } catch (err) {
    logger.warn(
      { err: err.message, invoiceId },
      "Payment confirmation email failed",
    );
  }
};

// ─── Payment failed ───────────────────────────────────────────────────────────

const handlePaymentFailed = async (payload) => {
  const payment = payload.payment?.entity;
  if (!payment) return;

  const invoiceId = payment.notes?.invoiceId;
  if (!invoiceId) return;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return;

  // Only transition if currently sent/viewed — not if already paid
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

// ─── Manual mark as paid ──────────────────────────────────────────────────────
//
// Used when the webhook never arrives or payment was made outside Razorpay.
// Requires the freelancer to enter the Razorpay payment ID for audit purposes.

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
