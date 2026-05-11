const nodemailer = require('nodemailer');
const logger     = require('./logger');

let transporter = null;

const createTransporter = () => {
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Force IPv4 — Railway does not support IPv6 outbound
    family: 4,
    tls: {
      rejectUnauthorized: false,
    },
  });

  return transporter;
};

const verifyEmailConnection = async () => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn('SMTP credentials not configured — emails will not send');
      return;
    }

    const t = getTransporter();
    await t.verify();
    logger.info('SMTP connection verified');
  } catch (err) {
    logger.warn(
      { err: err.message },
      'SMTP verification failed — emails will not send'
    );
    // Do NOT throw — email failure must never crash the server
  }
};

const getTransporter = () => {
  if (!transporter) createTransporter();
  return transporter;
};

module.exports = { getTransporter, verifyEmailConnection, transporter: getTransporter() };