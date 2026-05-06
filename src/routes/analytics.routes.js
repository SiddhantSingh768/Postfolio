const express = require('express');
const router = express.Router();
const analyticsCtrl = require('../controllers/analytics.controller');
const invoiceCtrl = require('../controllers/invoice.controller');
const { protect } = require('../middleware/auth.middleware');
const workspaceScope = require('../middleware/workspaceScope');

router.use(protect, workspaceScope);

router.get('/dashboard', analyticsCtrl.getDashboard);
router.get('/revenue', analyticsCtrl.getRevenueTrend);
router.get('/projects/:projectId/audit-log', invoiceCtrl.getAuditLog);

module.exports = router;