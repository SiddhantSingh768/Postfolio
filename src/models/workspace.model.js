const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role:     { type: String, enum: ['owner', 'admin', 'member'], default: 'owner' },
    joinedAt: { type: Date, default: Date.now }
  }],
  plan:     { type: String, enum: ['solo', 'team'], default: 'solo' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Workspace', workspaceSchema);