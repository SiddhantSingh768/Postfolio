const deliverableService = require('../services/deliverable.service');
const asyncHandler       = require('../utils/asyncHandler');

const getSignature = asyncHandler(async (req, res) => {
  const params = await deliverableService.getUploadSignature(
    req.params.milestoneId,
    req.workspaceId
  );
  res.status(200).json({ status: 'success', data: params });
});

const create = asyncHandler(async (req, res) => {
  const deliverable = await deliverableService.createDeliverable(
    req.params.milestoneId,
    req.workspaceId,
    req.user._id,
    req.body
  );
  res.status(201).json({ status: 'success', data: { deliverable } });
});

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

const versionHistory = asyncHandler(async (req, res) => {
  const history = await deliverableService.getVersionHistory(
    req.params.milestoneId,
    req.workspaceId,
    req.query.filename
  );
  res.status(200).json({ status: 'success', data: { history } });
});

const update = asyncHandler(async (req, res) => {
  const deliverable = await deliverableService.updateDeliverable(
    req.params.id,
    req.workspaceId,
    req.body
  );
  res.status(200).json({ status: 'success', data: { deliverable } });
});

const remove = asyncHandler(async (req, res) => {
  const result = await deliverableService.deleteDeliverable(
    req.params.id,
    req.workspaceId
  );
  res.status(200).json({ status: 'success', data: result });
});

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