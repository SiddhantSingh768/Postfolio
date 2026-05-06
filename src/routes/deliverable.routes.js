const express         = require('express');
const { body, query } = require('express-validator');
const router          = express.Router();
const deliverableCtrl = require('../controllers/deliverable.controller');
const { protect }     = require('../middleware/auth.middleware');
const workspaceScope  = require('../middleware/workspaceScope');
const validateRequest = require('../middleware/validateRequest');

router.use(protect, workspaceScope);

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

router.patch('/:id', updateRules, validateRequest, deliverableCtrl.update);
router.delete('/:id', deliverableCtrl.remove);

router.get('/projects/:projectId/deliverables/zip', deliverableCtrl.downloadZip);

module.exports = router;