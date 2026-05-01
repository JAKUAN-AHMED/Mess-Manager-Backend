const express = require('express');
const router = express.Router();
const {
  getMonthlySummary,
  getUserBill,
  getAllBills,
  getYearlyTrend,
  cronSendMonthlyBills,
  adminSendMonthlyBills,
  billingEmailStatus,
} = require('../controllers/reportController');
const { protect, adminOnly } = require('../middlewares/auth');

// Public cron endpoint — protected by CRON_SECRET header (NOT JWT).
// MUST be declared before `router.use(protect)`.
router.post('/cron/send-monthly-bills', cronSendMonthlyBills);

router.use(protect);
router.get('/monthly-summary', getMonthlySummary);
router.get('/all-bills', getAllBills);
router.get('/yearly-trend', getYearlyTrend);
router.get('/user-bill/:userId', getUserBill);

// Admin-only billing email controls
router.get('/billing-email-status', billingEmailStatus);
router.post('/send-monthly-bills', adminOnly, adminSendMonthlyBills);

module.exports = router;
