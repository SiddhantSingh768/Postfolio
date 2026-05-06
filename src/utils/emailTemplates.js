
const otpEmailTemplate = (name, otp) => `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#1A56DB;">Verify your Postfolio account</h2>
  <p>Hi ${name},</p>
  <p>Your verification code is:</p>
  <div style="font-size:36px;font-weight:bold;letter-spacing:8px;background:#EFF6FF;
              padding:20px;text-align:center;border-radius:8px;color:#1A56DB;">
    ${otp}
  </div>
  <p style="color:#6B7280;font-size:14px;margin-top:16px;">
    This code expires in 10 minutes. Do not share it with anyone.
  </p>
</body></html>`;

const passwordResetTemplate = (name, resetUrl) => `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h2 style="color:#1A56DB;">Reset your Postfolio password</h2>
  <p>Hi ${name},</p>
  <p>Click below to reset your password. This link expires in 1 hour.</p>
  <a href="${resetUrl}" style="display:inline-block;background:#1A56DB;color:white;
     padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:8px;">
    Reset Password
  </a>
  <p style="color:#6B7280;font-size:14px;margin-top:16px;">
    If you didn't request this, ignore this email.
  </p>
</body></html>`;

const invoiceEmailTemplate = (invoice, freelancer, client, paymentLinkUrl) => `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#1A56DB;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">Invoice from ${freelancer.name}</h1>
    <p style="color:#bfdbfe;margin:4px 0 0;">${invoice.invoiceNumber}</p>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;">
    <p style="color:#374151;">Hi ${client.name},</p>
    <p style="color:#374151;">Please find your invoice for <strong>₹${invoice.grandTotal.toLocaleString('en-IN')}</strong> attached. Payment is due by <strong>${new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>.</p>
    ${paymentLinkUrl ? `
      <div style="text-align:center;margin:24px 0;">
        <a href="${paymentLinkUrl}" style="background:#1A56DB;color:white;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;display:inline-block;">
          Pay Now — ₹${invoice.grandTotal.toLocaleString('en-IN')}
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;text-align:center;">Or copy this link: ${paymentLinkUrl}</p>
    ` : ''}
    <p style="color:#6b7280;font-size:12px;">If you have questions, reply to this email.</p>
  </div>
  <div style="background:#f3f4f6;padding:12px;border-radius:0 0 8px 8px;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;margin:0;">Powered by Postfolio</p>
  </div>
</body></html>`;

const paymentConfirmationTemplate = (invoice, client) => `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#059669;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">Payment Received</h1>
    <p style="color:#a7f3d0;margin:4px 0 0;">${invoice.invoiceNumber}</p>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;">
    <p style="color:#374151;">Hi ${client.name},</p>
    <p style="color:#374151;">We've received your payment of <strong>₹${invoice.paidAmount?.toLocaleString('en-IN')}</strong> for invoice ${invoice.invoiceNumber}.</p>
    <p style="color:#374151;">Thank you for your prompt payment.</p>
  </div>
</body></html>`;

const paymentMismatchTemplate = (invoice, paidAmount, expectedAmount) => `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#dc2626;padding:24px;border-radius:8px 8px 0 0;">
    <h1 style="color:white;margin:0;font-size:20px;">Payment Amount Mismatch</h1>
    <p style="color:#fecaca;margin:4px 0 0;">Manual review required</p>
  </div>
  <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;">
    <p style="color:#374151;"><strong>Invoice:</strong> ${invoice.invoiceNumber}</p>
    <p style="color:#374151;"><strong>Expected:</strong> ₹${expectedAmount.toLocaleString('en-IN')}</p>
    <p style="color:#dc2626;"><strong>Received:</strong> ₹${paidAmount.toLocaleString('en-IN')}</p>
    <p style="color:#374151;">The invoice has NOT been marked as paid. Please review this payment manually in your Razorpay dashboard.</p>
  </div>
</body></html>`;

module.exports = {
  otpEmailTemplate,
  passwordResetTemplate,
  invoiceEmailTemplate,
  paymentConfirmationTemplate,
  paymentMismatchTemplate,
};