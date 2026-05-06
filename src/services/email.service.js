const { transporter } = require("../config/nodemailer");
const {
  otpEmailTemplate,
  passwordResetTemplate,
} = require("../utils/emailTemplates");
const logger = require("../config/logger");

const sendOTPEmail = async (to, name, otp) => {
  try {
    await transporter.sendMail({
      from: `"Postfolio" <${process.env.SMTP_USER}>`,
      to,
      subject: "Verify your Postfolio account",
      html: otpEmailTemplate(name, otp),
    });
    logger.info({ to }, "OTP email sent");
  } catch (err) {
    logger.warn({ err: err.message, to }, "Failed to send OTP email");
  }
};

const sendPasswordResetEmail = async (to, name, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
  await transporter.sendMail({
    from: `"Postfolio" <${process.env.SMTP_USER}>`,
    to,
    subject: "Reset your Postfolio password",
    html: passwordResetTemplate(name, resetUrl),
  });
};

const {
  invoiceEmailTemplate,
  paymentConfirmationTemplate,
  paymentMismatchTemplate,
} = require("../utils/emailTemplates");

const sendInvoiceEmail = async (
  invoice,
  freelancer,
  client,
  paymentLinkUrl,
) => {
  try {
    await transporter.sendMail({
      from: `"${freelancer.name} via Postfolio" <${process.env.SMTP_USER}>`,
      to: client.email,
      subject: `Invoice ${invoice.invoiceNumber} from ${freelancer.name} — ₹${invoice.grandTotal.toLocaleString("en-IN")}`,
      html: invoiceEmailTemplate(invoice, freelancer, client, paymentLinkUrl),
    });
    logger.info(
      { invoiceId: invoice._id, to: client.email },
      "Invoice email sent",
    );
  } catch (err) {
    logger.warn(
      { err: err.message, invoiceId: invoice._id },
      "Invoice email failed",
    );
    throw err;
  }
};

const sendPaymentConfirmationEmail = async (invoice, client) => {
  try {
    await transporter.sendMail({
      from: `"Postfolio" <${process.env.SMTP_USER}>`,
      to: client.email,
      subject: `Payment received — Invoice ${invoice.invoiceNumber}`,
      html: paymentConfirmationTemplate(invoice, client),
    });
    logger.info({ invoiceId: invoice._id }, "Payment confirmation email sent");
  } catch (err) {
    logger.warn({ err: err.message }, "Payment confirmation email failed");
  }
};

const sendPaymentMismatchAlert = async (
  invoice,
  paidAmount,
  expectedAmount,
) => {
  try {
    await transporter.sendMail({
      from: `"Postfolio Alert" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: `⚠️ Payment mismatch on Invoice ${invoice.invoiceNumber}`,
      html: paymentMismatchTemplate(invoice, paidAmount, expectedAmount),
    });
  } catch (err) {
    logger.warn({ err: err.message }, "Mismatch alert email failed");
  }
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetEmail,
  sendInvoiceEmail,
  sendPaymentConfirmationEmail,
  sendPaymentMismatchAlert,
};
