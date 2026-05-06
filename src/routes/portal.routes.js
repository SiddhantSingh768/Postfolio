const express     = require('express');
const router      = express.Router();
const portalCtrl  = require('../controllers/portal.controller');
const portalAuth  = require('../middleware/portalAuth.middleware');


router.get('/:projectId',
  portalAuth,
  portalCtrl.getPortalView
);

router.get('/:projectId/invoice/:invoiceId/view',
  portalAuth,
  portalCtrl.viewInvoice
);

router.post('/:projectId/milestones/:milestoneId/approve',
  portalAuth,
  portalCtrl.approveMilestone
);

module.exports = router;