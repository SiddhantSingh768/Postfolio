const express         = require('express');
const { body }        = require('express-validator');
const router          = express.Router();
const milestoneCtrl   = require('../controllers/milestone.controller');
const { protect }     = require('../middleware/auth.middleware');
const workspaceScope  = require('../middleware/workspaceScope');
const validateRequest = require('../middleware/validateRequest');

router.use(protect, workspaceScope);

const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed'];

const updateRules = [
  body('title').optional().trim().notEmpty(),
  body('status').optional().isIn(MILESTONE_STATUSES)
    .withMessage(`Status must be one of: ${MILESTONE_STATUSES.join(', ')}`),
  body('dueDate').optional().isISO8601(),
];

router.patch('/:id',  updateRules, validateRequest, milestoneCtrl.update);
router.delete('/:id', milestoneCtrl.remove);

module.exports = router;