const deliverableService = require('../services/deliverable.service');
const asyncHandler       = require('../utils/asyncHandler');

// Get signed upload parameters (called before uploading to Cloudinary)
const getSignature = asyncHandler(async (req, res) => {
  const params = await deliverableService.getUploadSignature(
    req.params.milestoneId,
    req.workspaceId
  );
  res.status(200).json({ status: 'success', data: params });
});

// Create deliverable record (called after Cloudinary upload completes)
const create = asyncHandler(async (req, res) => {
  const deliverable = await deliverableService.createDeliverable(
    req.params.milestoneId,
    req.workspaceId,
    req.user._id,
    req.body
  );
  res.status(201).json({ status: 'success', data: { deliverable } });
});

// List deliverables for a milestone
const list = asyncHandler(async (req, res) => {
  const opts = {
    showAll: req.query.showAll === 'true',
  };
  const deliverables = await deliverableService.listDeliverables(
    req.params.milestoneId,
    req.workspaceId,
    opts
  );
  res.status(200).json({ status: 'success', data: { deliverables } });
});

// Version history for a specific filename within a milestone
const versionHistory = asyncHandler(async (req, res) => {
  const history = await deliverableService.getVersionHistory(
    req.params.milestoneId,
    req.workspaceId,
    req.query.filename
  );
  res.status(200).json({ status: 'success', data: { history } });
});

// Update deliverable metadata (visibility, change notes)
const update = asyncHandler(async (req, res) => {
  const deliverable = await deliverableService.updateDeliverable(
    req.params.id,
    req.workspaceId,
    req.body
  );
  res.status(200).json({ status: 'success', data: { deliverable } });
});

// Delete a deliverable version
const remove = asyncHandler(async (req, res) => {
  const result = await deliverableService.deleteDeliverable(
    req.params.id,
    req.workspaceId
  );
  res.status(200).json({ status: 'success', data: result });
});

// Stream ZIP of all current deliverables for a project
// Note: this controller does NOT use asyncHandler because
// streamProjectZip writes directly to res — a thrown error
// after headers are sent cannot be handled normally
const downloadZip = async (req, res, next) => {
  try {
    await deliverableService.streamProjectZip(
      req.params.projectId,
      req.workspaceId,
      res
    );
  } catch (err) {
    next(err);
  }
};

module.exports = { getSignature, create, list, versionHistory, update, remove, downloadZip };