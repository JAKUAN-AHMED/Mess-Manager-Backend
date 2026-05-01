const User = require('../models/User');
const Payment = require('../models/Payment');
const Mess = require('../models/Mess');
const Meal = require('../models/Meal');
const BillingEmailLog = require('../models/BillingEmailLog');
const { sendBillEmail } = require('../services/emailService');
const { getMonthlySummary, getUserMonthlyBill, getYearlyMealTrend, getExpenseContributions, getUserAdvanceTotal } = require('../services/reportService');

// Helper: repair null-mess users and return mess user IDs.
//
// NOTE: We intentionally include archived users here. They may have meals,
// expenses, or payments in the requested month — those records must still
// be counted toward the monthly summary, otherwise removing a member would
// retroactively change everyone else's bill.
const getMessUserIds = async (messId) => {
  if (messId) {
    await User.updateMany(
      { $or: [{ mess: { $exists: false } }, { mess: null }] },
      { $set: { mess: messId } }
    );
  }
  return User.find({ mess: messId }).distinct('_id');
};

// GET /api/reports/monthly-summary?month=M&year=Y
exports.getMonthlySummary = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const userIds = await getMessUserIds(req.user.mess);
    const summary = await getMonthlySummary(startDate, endDate, userIds);
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

    const userIds = await getMessUserIds(req.user.mess);
    const { mealRate } = await getMonthlySummary(startDate, endDate, userIds);
    const [bill, contribs, payment, user] = await Promise.all([
      getUserMonthlyBill(req.params.userId, startDate, endDate, mealRate),
      getExpenseContributions(startDate, endDate, userIds),
      Payment.findOne({ user: req.params.userId, month, year }),
      User.findById(req.params.userId).select('name phone roomNumber'),
    ]);

    const expensePaid = contribs[req.params.userId] || 0;
    const advanceFromBilling = payment?.advanceAmount || 0;
    const advanceFromPage = await getUserAdvanceTotal(req.params.userId, month, year);
    const advance = parseFloat((advanceFromBilling + advanceFromPage).toFixed(2));
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

    const messId = req.user.mess;
    const userIds = await getMessUserIds(messId);

    // Show bills for: (a) all currently-active members, AND
    // (b) any archived member that actually had meals/expenses/payments
    //     in the requested month (so their past bill stays visible).
    const allMessUsers = await User.find({ mess: messId })
      .select('name phone roomNumber email isActive isArchived archivedAt');

    const [{ totalCost, totalMealsCount, mealRate }, expenseContributions] = await Promise.all([
      getMonthlySummary(startDate, endDate, userIds),
      getExpenseContributions(startDate, endDate, userIds),
    ]);

    const billsRaw = await Promise.all(
      allMessUsers.map(async (user) => {
        const bill = await getUserMonthlyBill(user._id, startDate, endDate, mealRate);
        const payment = await Payment.findOne({ user: user._id, month, year });
        const expensePaid = expenseContributions[user._id.toString()] || 0;
        const advanceFromBilling = payment?.advanceAmount || 0;
        const advanceFromPage = await getUserAdvanceTotal(user._id, month, year);
        const advance = parseFloat((advanceFromBilling + advanceFromPage).toFixed(2));
        const netBalance = parseFloat((expensePaid + advance - bill.foodCost).toFixed(2));
        return { user, ...bill, payment, expensePaid, advance, netBalance };
      })
    );

    const bills = billsRaw.filter((b) => {
      if (!b.user.isArchived) return true;
      // Archived users only appear if they have something to show this month
      return (
        (b.totalMeals || 0) > 0 ||
        (b.expensePaid || 0) > 0 ||
        (b.advance || 0) > 0 ||
        b.payment
      );
    });

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
    const userIds = await getMessUserIds(req.user.mess);
    const trend = await getYearlyMealTrend(userIds);
    res.json({ success: true, data: trend });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ─────────────────────────────────────────────────────────────
 * Monthly billing email
 *
 * Two ways to fire this:
 *   1. Vercel Cron hits POST /api/reports/cron/send-monthly-bills
 *      with header `x-cron-secret: <CRON_SECRET>` once a day. The job
 *      will only actually send on the LAST DAY of the month (and skip
 *      any mess that already has a BillingEmailLog for that month).
 *
 *   2. An admin clicks "এখনই পাঠান" in the Billing page → frontend
 *      hits POST /api/reports/send-monthly-bills (auth + adminOnly).
 *      This sends bills for the current month for THEIR mess only.
 * ───────────────────────────────────────────────────────────── */

// Internal: build & send all bills for one mess for one month.
async function dispatchBillsForMess({ messId, month, year, force = false, triggeredBy = 'manual' }) {
  const mess = await Mess.findById(messId);
  if (!mess) return { ok: false, error: 'mess not found' };

  // Idempotency: skip if we've already sent for this (mess, month, year)
  if (!force) {
    const existing = await BillingEmailLog.findOne({ mess: messId, month, year });
    if (existing) {
      return { ok: true, skipped: true, reason: 'already-sent', sentAt: existing.sentAt };
    }
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const userIds = await User.find({ mess: messId }).distinct('_id');
  const summary = await getMonthlySummary(startDate, endDate, userIds);
  const expenseContributions = await getExpenseContributions(startDate, endDate, userIds);

  // Send to: every member with an email who had meals/payments/etc this month
  const candidates = await User.find({ mess: messId })
    .select('name phone email role isArchived');

  let sent = 0, skipped = 0;
  for (const user of candidates) {
    if (!user.email) { skipped++; continue; }

    const bill = await getUserMonthlyBill(user._id, startDate, endDate, summary.mealRate);
    const payment = await Payment.findOne({ user: user._id, month, year });
    const expensePaid = expenseContributions[user._id.toString()] || 0;
    const advance = parseFloat(
      ((payment?.advanceAmount || 0) + (await getUserAdvanceTotal(user._id, month, year))).toFixed(2)
    );
    const netBalance = parseFloat((expensePaid + advance - bill.foodCost).toFixed(2));

    // Don't email archived members who had no activity this month
    const hasActivity = (bill.totalMeals || 0) > 0 || expensePaid > 0 || advance > 0 || payment;
    if (user.isArchived && !hasActivity) { skipped++; continue; }
    // Don't email active members who had zero of everything (nothing to bill)
    if (!hasActivity) { skipped++; continue; }

    const ok = await sendBillEmail({
      to: user.email,
      messName: mess.name,
      month, year,
      bill: { ...bill, user, payment, expensePaid, advance, netBalance },
      joinCode: user.role === 'admin' ? mess.joinCode : null,
    });
    if (ok) sent++;
    else skipped++;
  }

  // Upsert idempotency record
  await BillingEmailLog.findOneAndUpdate(
    { mess: messId, month, year },
    { sentAt: new Date(), sentCount: sent, skippedCount: skipped, triggeredBy },
    { upsert: true, new: true }
  );

  return { ok: true, sent, skipped };
}

// Helper: returns true if `date` is the last day of its month
function isLastDayOfMonth(date) {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return next.getMonth() !== date.getMonth();
}

// POST /api/reports/cron/send-monthly-bills  — invoked by Vercel Cron
exports.cronSendMonthlyBills = async (req, res) => {
  try {
    // Authenticate the cron caller
    const provided =
      req.headers['x-cron-secret'] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null);
    const expected = process.env.CRON_SECRET;
    if (!expected || provided !== expected) {
      return res.status(401).json({ success: false, error: 'invalid cron secret' });
    }

    const force = String(req.query.force || '').toLowerCase() === '1' ||
                  String(req.query.force || '').toLowerCase() === 'true';

    // Compute "today" in Asia/Dhaka so end-of-month emails fire correctly
    // regardless of the Vercel server timezone.
    const nowUtc = new Date();
    const dhaka = new Date(nowUtc.getTime() + 6 * 60 * 60 * 1000);
    const month = dhaka.getUTCMonth() + 1;
    const year = dhaka.getUTCFullYear();

    if (!force && !isLastDayOfMonth(new Date(Date.UTC(year, month - 1, dhaka.getUTCDate())))) {
      return res.json({ success: true, skipped: true, reason: 'not-last-day-of-month' });
    }

    const messes = await Mess.find({ isActive: true }).select('_id name');
    const results = [];
    for (const mess of messes) {
      const r = await dispatchBillsForMess({
        messId: mess._id, month, year, force, triggeredBy: 'cron',
      });
      results.push({ mess: mess.name, ...r });
    }
    res.json({ success: true, month, year, results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/reports/send-monthly-bills  — admin manually triggers for own mess
exports.adminSendMonthlyBills = async (req, res) => {
  try {
    const month = parseInt(req.body.month) || new Date().getMonth() + 1;
    const year = parseInt(req.body.year) || new Date().getFullYear();
    const force = !!req.body.force;

    const result = await dispatchBillsForMess({
      messId: req.user.mess, month, year, force, triggeredBy: 'manual',
    });

    if (!result.ok) return res.status(400).json({ success: false, error: result.error });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/reports/billing-email-status?month=&year=
exports.billingEmailStatus = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const log = await BillingEmailLog.findOne({ mess: req.user.mess, month, year });

    // Show admin how many members have email so they know who'll be reached
    const messId = req.user.mess;
    const [withEmail, total] = await Promise.all([
      User.countDocuments({ mess: messId, email: { $ne: '' }, isArchived: { $ne: true } }),
      User.countDocuments({ mess: messId, isArchived: { $ne: true } }),
    ]);

    // Has the last meal of the month been entered?
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const lastDayStart = new Date(year, month, 0, 0, 0, 0);
    const userIds = await User.find({ mess: messId }).distinct('_id');
    const lastDayMealCount = await Meal.countDocuments({
      user: { $in: userIds },
      date: { $gte: lastDayStart, $lte: endDate },
    });

    res.json({
      success: true,
      data: {
        month, year,
        sent: !!log,
        sentAt: log?.sentAt || null,
        sentCount: log?.sentCount || 0,
        skippedCount: log?.skippedCount || 0,
        triggeredBy: log?.triggeredBy || null,
        membersWithEmail: withEmail,
        totalActiveMembers: total,
        lastDayHasMeals: lastDayMealCount > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
