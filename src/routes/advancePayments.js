const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middlewares/auth');
const { getAdvancePayments, addAdvancePayment, deleteAdvancePayment } = require('../controllers/advancePaymentController');

router.get('/',    protect, getAdvancePayments);
router.post('/',   protect, adminOnly, addAdvancePayment);
router.delete('/:id', protect, adminOnly, deleteAdvancePayment);

module.exports = router;
