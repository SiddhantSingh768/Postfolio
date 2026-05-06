const express         = require('express');
const { body, query } = require('express-validator');
const router          = express.Router();
const deliverableCtrl = require('../controllers/deliverable.controller');
const { protect }     = require('../middleware/auth.middleware');
const workspaceScope  = require('../middleware/workspaceScope');
const validateRequest = require('../middleware/validateRequest');

router.use(protect, workspaceScope);

// Validation rules for creating a deliverable record
// (data comes from Cloudinary's upload response)
const createRules = [
  body('filename').trim().notEmpty().withMessage('Filename is required'),
  body('publicId').trim().notEmpty().withMessage('Cloudinary publicId is required'),
  body('fileUrl').trim().isURL().withMessage('Valid file URL is required'),
  body('fileSize').optional().isInt({ min: 1 }),
  body('mimeType').optional().isString(),
  body('changeNotes').optional().trim().isLength({ max: 500 }),
  body('isClientVisible').optional().isBoolean(),
];

const updateRules = [
  body('isClientVisible').optional().isBoolean(),
  body('changeNotes').optional().trim().isLength({ max: 500 }),
];

// Milestone-scoped routes
// GET  /milestones/:milestoneId/deliverables/sign    → get upload signature
// GET  /milestones/:milestoneId/deliverables         → list deliverables
// GET  /milestones/:milestoneId/deliverables/history → version history
// POST /milestones/:milestoneId/deliverables         → create after upload

router.get(
  '/milestones/:milestoneId/deliverables/sign',
  deliverableCtrl.getSignature
);

router.get(
  '/milestones/:milestoneId/deliverables/history',
  [query('filename').trim().notEmpty()],
  validateRequest,
  deliverableCtrl.versionHistory
);

router.get(
  '/milestones/:milestoneId/deliverables',
  deliverableCtrl.list
);

router.post(
  '/milestones/:milestoneId/deliverables',
  createRules,
  validateRequest,
  deliverableCtrl.create
);

// Deliverable-level routes
router.patch('/:id', updateRules, validateRequest, deliverableCtrl.update);
router.delete('/:id', deliverableCtrl.remove);

// Project-level ZIP download
router.get('/projects/:projectId/deliverables/zip', deliverableCtrl.downloadZip);

module.exports = router;