const User = require('../models/User');
const Payment = require('../models/Payment');
const { getMonthlySummary, getUserMonthlyBill, getYearlyMealTrend, getExpenseContributions } = require('../services/reportService');

// GET /api/reports/monthly-summary?month=M&year=Y
exports.getMonthlySummary = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const summary = await getMonthlySummary(startDate, endDate);
    res.json({ success: true, data: { ...summary, month, year } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/reports/user-bill/:userId?month=M&year=Y
exports.getUserBill = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const { mealRate } = await getMonthlySummary(startDate, endDate);
    const [bill, contribs, payment, user] = await Promise.all([
      getUserMonthlyBill(req.params.userId, startDate, endDate, mealRate),
      getExpenseContributions(startDate, endDate),
      Payment.findOne({ user: req.params.userId, month, year }),
      User.findById(req.params.userId).select('name phone roomNumber advancedPayment'),
    ]);

    const expensePaid = contribs[req.params.userId] || 0;
    const advance = user?.advancedPayment || 0;
    const netBalance = parseFloat((expensePaid + advance - bill.foodCost).toFixed(2));

    res.json({
      success: true,
      data: { user, ...bill, payment, month, year, expensePaid, advance, netBalance },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/reports/all-bills?month=M&year=Y
exports.getAllBills = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const [{ totalCost, totalMealsCount, mealRate }, expenseContributions, users] = await Promise.all([
      getMonthlySummary(startDate, endDate),
      getExpenseContributions(startDate, endDate),
      User.find({ isActive: true }).select('name phone roomNumber advancedPayment'),
    ]);

    const bills = await Promise.all(
      users.map(async (user) => {
        const bill = await getUserMonthlyBill(user._id, startDate, endDate, mealRate);
        const payment = await Payment.findOne({ user: user._id, month, year });
        const expensePaid = expenseContributions[user._id.toString()] || 0;
        const advance = user.advancedPayment || 0;
        // netBalance: positive = mess owes member, negative = member owes mess
        const netBalance = parseFloat((expensePaid + advance - bill.foodCost).toFixed(2));
        return { user, ...bill, payment, expensePaid, advance, netBalance };
      })
    );

    res.json({
      success: true,
      data: { summary: { totalCost, totalMealsCount, mealRate, month, year }, bills },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/reports/yearly-trend
exports.getYearlyTrend = async (req, res) => {
  try {
    const trend = await getYearlyMealTrend();
    res.json({ success: true, data: trend });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
