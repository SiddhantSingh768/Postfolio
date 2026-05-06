const nodemailer = require('nodemailer');
const logger     = require('./logger');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    logger.info('SMTP connection verified');
  } catch (err) {
    logger.warn({ err: err.message }, 'SMTP verification failed — emails will not send');
  }
};

module.exports = { transporter, verifyEmailConnection };