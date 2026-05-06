const mongoose = require('mongoose');

// Idempotency store for Razorpay webhooks (Phase 5).
// Built here in Phase 4 so the invoice model can reference it.
// If the same Razorpay event arrives twice (Razorpay retries on timeout),
// we check this collection first and silently ignore duplicates.

const processedEventSchema = new mongoose.Schema({
  eventId: {
    type:     String,
    required: true,
    unique:   true  // Enforces idempotency at the DB level
  },
  processedAt: {
    type:    Date,
    default: Date.now
  }
});

// TTL index: auto-delete records after 30 days
// Keeps the collection from growing forever
// 30 days is well beyond any realistic Razorpay retry window
processedEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 2592000 } // 30 days in seconds
);

module.exports = mongoose.model('ProcessedEvent', processedEventSchema);