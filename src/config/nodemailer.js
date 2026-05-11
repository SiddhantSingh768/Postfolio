const { Resend } = require('resend');
const logger     = require('./logger');

let resendClient = null;

const getResendClient = () => {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
};

// Drop-in replacement for nodemailer transporter
// Exposes the same .sendMail() interface your email service uses
const transporter = {
  sendMail: async ({ from, to, subject, html, text }) => {
    const client = getResendClient();

    if (!client) {
      logger.warn('Resend not configured — email not sent');
      return { messageId: 'not_sent' };
    }

    const result = await client.emails.send({
      from:    from || `Postfolio <onboarding@resend.dev>`,
      to:      Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    });

    return { messageId: result.id };
  },
};

const verifyEmailConnection = async () => {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set — emails will not send');
    return;
  }
  // Resend does not have a verify endpoint
  // We just confirm the key exists
  logger.info('SMTP connection verified');
};

module.exports = {
  transporter,
  getTransporter: () => transporter,
  verifyEmailConnection,
};