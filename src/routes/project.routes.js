const express         = require('express');
const { body }        = require('express-validator');
const router          = express.Router();
const projectCtrl     = require('../controllers/project.controller');
const milestoneCtrl   = require('../controllers/milestone.controller');
const { protect }     = require('../middleware/auth.middleware');
const workspaceScope  = require('../middleware/workspaceScope');
const validateRequest = require('../middleware/validateRequest');

router.use(protect, workspaceScope);

const PROJECT_STATUSES = ['draft', 'active', 'on_hold', 'completed', 'cancelled'];

const createRules = [
  body('clientId').notEmpty().withMessage('Client ID is required').isMongoId(),
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('description').optional().trim().isLength({ max: 2000 }),
  body('budget').optional().isFloat({ min: 0 }).withMessage('Budget must be a positive number'),
  body('startDate').optional().isISO8601().withMessage('Invalid start date'),
  body('endDate').optional().isISO8601().withMessage('Invalid end date'),
];

const updateRules = [
  body('title').optional().trim().notEmpty().isLength({ max: 200 }),
  body('status').optional().isIn(PROJECT_STATUSES).withMessage(`Status must be one of: ${PROJECT_STATUSES.join(', ')}`),
  body('budget').optional().isFloat({ min: 0 }),
];

const milestoneRules = [
  body('title').trim().notEmpty().withMessage('Milestone title is required'),
  body('dueDate').optional().isISO8601().withMessage('Invalid due date'),
  body('order').optional().isInt({ min: 1 }),
];

router.get('/',     projectCtrl.list);
router.post('/',    createRules, validateRequest, projectCtrl.create);
router.get('/:id',  projectCtrl.get);
router.patch('/:id', updateRules, validateRequest, projectCtrl.update);
router.delete('/:id', projectCtrl.remove);


const portalService = require('../services/portal.service');
const asyncHandler  = require('../utils/asyncHandler');

router.post('/:id/portal', asyncHandler(async (req, res) => {
  const expiresInDays = req.body.expiresInDays || 30;
  const result = await portalService.generatePortalAccess(
    req.params.id,
    req.workspaceId,
    expiresInDays
  );
  res.status(200).json({ status: 'success', data: result });
}));

router.delete('/:id/portal', asyncHandler(async (req, res) => {
  const result = await portalService.revokePortalAccess(
    req.params.id,
    req.workspaceId
  );
  res.status(200).json({ status: 'success', data: result });
}));

router.post('/:projectId/milestones', milestoneRules, validateRequest, milestoneCtrl.add);

module.exports = router;