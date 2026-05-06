const express         = require('express');
const { body }        = require('express-validator');
const router          = express.Router();
const invoiceCtrl     = require('../controllers/invoice.controller');
const { protect }     = require('../middleware/auth.middleware');
const workspaceScope  = require('../middleware/workspaceScope');
const validateRequest = require('../middleware/validateRequest');


router.use(protect, workspaceScope);

const VALID_GST_RATES = [0, 5, 12, 18, 28];

const lineItemRules = [
  body('lineItems')
    .isArray({ min: 1 })
    .withMessage('At least one line item is required'),
  body('lineItems.*.description')
    .trim().notEmpty()
    .withMessage('Line item description is required'),
  body('lineItems.*.qty')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  body('lineItems.*.unitPrice')
    .isFloat({ min: 0 })
    .withMessage('Unit price must be 0 or greater'),
  body('lineItems.*.gstRate')
    .isIn(VALID_GST_RATES)
    .withMessage(`GST rate must be one of: ${VALID_GST_RATES.join(', ')}`),
];

const createRules = [
  body('clientId')
    .notEmpty().withMessage('Client ID is required')
    .isMongoId().withMessage('Invalid client ID'),
  body('projectId')
    .optional()
    .isMongoId().withMessage('Invalid project ID'),
  body('dueDate')
    .optional()
    .isISO8601().withMessage('Invalid due date'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }),
  ...lineItemRules,
];

const updateRules = [
  body('dueDate')
    .optional()
    .isISO8601(),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }),
  body('lineItems')
    .optional()
    .isArray({ min: 1 }),
  body('lineItems.*.description')
    .if(body('lineItems').exists())
    .trim().notEmpty(),
  body('lineItems.*.qty')
    .if(body('lineItems').exists())
    .isFloat({ min: 0.01 }),
  body('lineItems.*.unitPrice')
    .if(body('lineItems').exists())
    .isFloat({ min: 0 }),
  body('lineItems.*.gstRate')
    .if(body('lineItems').exists())
    .isIn(VALID_GST_RATES),
];

router.get('/',                  invoiceCtrl.list);
router.post('/',                 createRules,  validateRequest, invoiceCtrl.create);
router.get('/:id',               invoiceCtrl.get);
router.patch('/:id',             updateRules,  validateRequest, invoiceCtrl.update);
router.post('/:id/generate-pdf', invoiceCtrl.generatePDF);
router.get('/:id/pdf', invoiceCtrl.viewPDF);
router.post('/:id/cancel',       invoiceCtrl.cancel);
router.post('/:id/send',      invoiceCtrl.send);
router.post('/:id/mark-paid', [
  body('razorpayPaymentId').optional().trim()
], validateRequest, invoiceCtrl.markPaid);

router.get('/projects/:projectId/audit-log', invoiceCtrl.getAuditLog);

module.exports = router;