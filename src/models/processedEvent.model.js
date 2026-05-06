const mongoose = require('mongoose');


const processedEventSchema = new mongoose.Schema({
  eventId: {
    type:     String,
    required: true,
    unique:   true 
  },
  processedAt: {
    type:    Date,
    default: Date.now
  }
});

processedEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 2592000 } 
);

module.exports = mongoose.model('ProcessedEvent', processedEventSchema);