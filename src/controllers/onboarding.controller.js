const onboardingService = require('../services/onboarding.service');
const asyncHandler      = require('../utils/asyncHandler');

const getStatus = asyncHandler(async (req, res) => {
  const data = await onboardingService.getOnboardingStatus(
    req.user._id,
    req.workspaceId
  );
  res.status(200).json({ status: 'success', data });
});

const dismiss = asyncHandler(async (req, res) => {
  const data = await onboardingService.dismissOnboarding(req.user._id);
  res.status(200).json({ status: 'success', data });
});

const seedDemo = asyncHandler(async (req, res) => {
  const data = await onboardingService.seedDemoWorkspace(
    req.user._id,
    req.workspaceId
  );
  res.status(201).json({ status: 'success', data });
});

module.exports = { getStatus, dismiss, seedDemo };