const mongoose = require('mongoose');

// Allowed MIME types — anything else is rejected at the service layer
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'video/mp4',
];

const deliverableSchema = new mongoose.Schema({
  // Every deliverable belongs to a workspace, project, and milestone.
  // workspace is denormalised here (instead of only living on project)
  // so we can scope all queries with a single workspace filter.
  workspace: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Workspace',
    required: true,
    index:    true
  },
  project: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Project',
    required: true,
    index:    true
  },
  milestone: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Milestone',
    required: true,
    index:    true
  },

  // File metadata — populated from Cloudinary's response after upload
  filename:  { type: String, required: true },
  publicId:  { type: String, required: true }, // Cloudinary public_id
  fileUrl:   { type: String, required: true }, // Cloudinary secure_url
  fileSize:  { type: Number, default: null  }, // bytes
  mimeType:  { type: String, default: null  },

  // Versioning
  // version increments each time a new file is uploaded to the same milestone.
  // isCurrent: true means this is the latest version.
  // isCurrent: false means it was superseded by a newer upload.
  // Old versions are NEVER deleted — they stay for audit purposes.
  version:   { type: Number, default: 1, min: 1 },
  isCurrent: { type: Boolean, default: true, index: true },

  // Change notes — what changed in this version vs the previous one
  changeNotes: { type: String, default: null, maxlength: 500 },

  // Visibility — freelancer controls what the client sees in the portal
  isClientVisible: { type: Boolean, default: true },

  // Who uploaded this version
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    default: null
  }

}, { timestamps: true });

// Compound indexes for common query patterns
deliverableSchema.index({ milestone: 1, isCurrent: 1 });
deliverableSchema.index({ milestone: 1, version:   1 });
deliverableSchema.index({ project:   1, isCurrent: 1 });
deliverableSchema.index({ workspace: 1, createdAt: -1 });

// Static method: returns ALLOWED_MIME_TYPES for use in validation
deliverableSchema.statics.getAllowedMimeTypes = function () {
  return ALLOWED_MIME_TYPES;
};

module.exports = mongoose.model('Deliverable', deliverableSchema);