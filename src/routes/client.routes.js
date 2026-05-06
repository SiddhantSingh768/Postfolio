const express         = require('express');
const { body, query } = require('express-validator');
const router          = express.Router();
const clientCtrl      = require('../controllers/client.controller');
const { protect }     = require('../middleware/auth.middleware');
const workspaceScope  = require('../middleware/workspaceScope');
const validateRequest = require('../middleware/validateRequest');

router.use(protect, workspaceScope);

const createRules = [
  body('name').trim().notEmpty().withMessage('Client name is required').isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('company').optional().trim().isLength({ max: 100 }),
  body('phone').optional().trim(),
  body('gstin').optional().trim().isLength({ max: 20 }),
  body('notes').optional().trim().isLength({ max: 1000 }),
];

const updateRules = [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('company').optional().trim().isLength({ max: 100 }),
];

router.get('/',     clientCtrl.list);
router.post('/',    createRules, validateRequest, clientCtrl.create);
router.get('/:id',  clientCtrl.get);
router.patch('/:id', updateRules, validateRequest, clientCtrl.update);
router.delete('/:id', clientCtrl.archive);  // DELETE = soft archive, not destroy

module.exports = router;