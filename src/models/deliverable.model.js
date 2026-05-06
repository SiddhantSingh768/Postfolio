const mongoose = require('mongoose');
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
  filename:  { type: String, required: true },
  publicId:  { type: String, required: true },
  fileUrl:   { type: String, required: true },
  fileSize:  { type: Number, default: null  },
  mimeType:  { type: String, default: null  },
  version:   { type: Number, default: 1, min: 1 },
  isCurrent: { type: Boolean, default: true, index: true },
  changeNotes: { type: String, default: null, maxlength: 500 },
  isClientVisible: { type: Boolean, default: true },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'User',
    default: null
  }

}, { timestamps: true });
deliverableSchema.index({ milestone: 1, isCurrent: 1 });
deliverableSchema.index({ milestone: 1, version:   1 });
deliverableSchema.index({ project:   1, isCurrent: 1 });
deliverableSchema.index({ workspace: 1, createdAt: -1 });
deliverableSchema.statics.getAllowedMimeTypes = function () {
  return ALLOWED_MIME_TYPES;
};

module.exports = mongoose.model('Deliverable', deliverableSchema);