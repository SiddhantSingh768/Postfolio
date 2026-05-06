const express        = require('express');
const router         = express.Router();
const paymentService = require('../services/payment.service');
const logger         = require('../config/logger');

// POST /api/v1/webhooks/razorpay
// This route receives raw body — express.raw() is applied in app.js
// before this router is mounted
router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      logger.warn('Webhook received without signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    // req.body is a Buffer here (from express.raw())
    const result = await paymentService.handleWebhook(req.body, signature);

    // Always respond 200 quickly — Razorpay retries if it doesn't get 200
    res.status(200).json({ status: 'ok', result });

  } catch (err) {
    if (err.code === 'INVALID_WEBHOOK_SIGNATURE') {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    logger.error({ err: err.message }, 'Webhook processing error');
    // Still return 200 to prevent Razorpay retrying a non-recoverable error
    res.status(200).json({ status: 'error', message: err.message });
  }
});

module.exports = router;