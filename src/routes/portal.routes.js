const express     = require('express');
const router      = express.Router();
const portalCtrl  = require('../controllers/portal.controller');
const portalAuth  = require('../middleware/portalAuth.middleware');

// All portal routes use portalAuth instead of protect + workspaceScope
// The token is in the query string: ?token=xxx

// Full project view
router.get('/:projectId',
  portalAuth,
  portalCtrl.getPortalView
);

// Mark invoice as viewed
router.get('/:projectId/invoice/:invoiceId/view',
  portalAuth,
  portalCtrl.viewInvoice
);

// Submit milestone approval comment
router.post('/:projectId/milestones/:milestoneId/approve',
  portalAuth,
  portalCtrl.approveMilestone
);

module.exports = router;