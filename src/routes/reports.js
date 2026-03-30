const express = require('express');
const router = express.Router();
const { getMonthlySummary, getUserBill, getAllBills, getYearlyTrend } = require('../controllers/reportController');
const { protect } = require('../middlewares/auth');

router.use(protect);
router.get('/monthly-summary', getMonthlySummary);
router.get('/all-bills', getAllBills);
router.get('/yearly-trend', getYearlyTrend);
router.get('/user-bill/:userId', getUserBill);

module.exports = router;
