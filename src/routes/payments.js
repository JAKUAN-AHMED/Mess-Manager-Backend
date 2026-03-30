const express = require('express');
const router = express.Router();
const { recordPayment, getPayments } = require('../controllers/paymentController');
const { protect, adminOnly } = require('../middlewares/auth');

router.use(protect);
router.get('/', getPayments);
router.post('/', adminOnly, recordPayment);

module.exports = router;
