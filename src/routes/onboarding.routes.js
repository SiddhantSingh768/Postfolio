const express          = require('express');
const router           = express.Router();
const onboardingCtrl   = require('../controllers/onboarding.controller');
const { protect }      = require('../middleware/auth.middleware');
const workspaceScope   = require('../middleware/workspaceScope');

router.use(protect, workspaceScope);

router.get('/status',   onboardingCtrl.getStatus);
router.post('/dismiss', onboardingCtrl.dismiss);
router.post('/seed',    onboardingCtrl.seedDemo);

module.exports = router;    