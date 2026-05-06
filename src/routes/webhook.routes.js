const express        = require('express');
const router         = express.Router();
const paymentService = require('../services/payment.service');
const logger         = require('../config/logger');

router.post('/', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      logger.warn('Webhook received without signature header');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const result = await paymentService.handleWebhook(req.body, signature);

    res.status(200).json({ status: 'ok', result });

  } catch (err) {
    if (err.code === 'INVALID_WEBHOOK_SIGNATURE') {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    logger.error({ err: err.message }, 'Webhook processing error');
    res.status(200).json({ status: 'error', message: err.message });
  }
});

module.exports = router;