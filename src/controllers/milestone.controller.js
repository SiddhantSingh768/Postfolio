const milestoneService = require('../services/milestone.service');
const asyncHandler     = require('../utils/asyncHandler');

const add = asyncHandler(async (req, res) => {
  const milestone = await milestoneService.addMilestone(
    req.params.projectId,
    req.workspaceId,
    req.body
  );
  res.status(201).json({ status: 'success', data: { milestone } });
});

const update = asyncHandler(async (req, res) => {
  const milestone = await milestoneService.updateMilestone(
    req.params.id,
    req.workspaceId,
    req.body
  );
  res.status(200).json({ status: 'success', data: { milestone } });
});

const remove = asyncHandler(async (req, res) => {
  const result = await milestoneService.deleteMilestone(
    req.params.id,
    req.workspaceId
  );
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { add, update, remove };