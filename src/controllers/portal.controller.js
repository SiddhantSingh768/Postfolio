const portalService = require('../services/portal.service');
const asyncHandler  = require('../utils/asyncHandler');

// GET /portal/:projectId?token=xxx
// Returns full portal view for the client
const getPortalView = asyncHandler(async (req, res) => {
  const data = await portalService.getPortalView(
    req.portalProjectId,
    req.portalWorkspaceId
  );
  res.status(200).json({ status: 'success', data });
});

// GET /portal/:projectId/invoice/:invoiceId/view?token=xxx
// Marks invoice as viewed, returns PDF URL
const viewInvoice = asyncHandler(async (req, res) => {
  const result = await portalService.markInvoiceViewed(
    req.params.invoiceId,
    req.portalProjectId,
    req.portalWorkspaceId
  );
  res.status(200).json({ status: 'success', data: result });
});

// POST /portal/:projectId/milestones/:milestoneId/approve?token=xxx
// Client submits approval comment on a milestone
const approveMilestone = asyncHandler(async (req, res) => {
  const { comment } = req.body;
  if (!comment || !comment.trim()) {
    return res.status(400).json({
      status:  'error',
      code:    'COMMENT_REQUIRED',
      message: 'Approval comment cannot be empty'
    });
  }

  const result = await portalService.submitApprovalComment(
    req.params.milestoneId,
    req.portalProjectId,
    req.portalWorkspaceId,
    comment.trim().slice(0, 500) // Enforce 500 char limit
  );
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { getPortalView, viewInvoice, approveMilestone };