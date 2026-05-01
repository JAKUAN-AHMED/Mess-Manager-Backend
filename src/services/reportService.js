const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Meal = require('../models/Meal');
const MealAdjustment = require('../models/MealAdjustment');
const AdvancePayment = require('../models/AdvancePayment');

const getMonthlySummary = async (startDate, endDate, userIds) => {
  const month = startDate.getMonth() + 1;
  const year  = startDate.getFullYear();

  const [expenseResult, mealResult, adjResult] = await Promise.all([
    Expense.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate }, addedBy: { $in: userIds } } },
      { $group: { _id: null, totalExpense: { $sum: '$amount' } } },
    ]),
    Meal.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate }, user: { $in: userIds } } },
      { $sort: { updatedAt: -1 } },
      { $group: { _id: { user: '$user', day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+06:00' } } }, totalMeals: { $first: '$totalMeals' } } },
      { $group: { _id: null, totalMeals: { $sum: '$totalMeals' } } },
    ]),
    MealAdjustment.aggregate([
      { $match: { month, year, user: { $in: userIds } } },
      { $group: { _id: null, totalAdj: { $sum: '$amount' } } },
    ]),
  ]);

  const totalCost       = expenseResult.length > 0 ? expenseResult[0].totalExpense : 0;
  const rawMeals        = mealResult.length > 0 ? mealResult[0].totalMeals : 0;
  const totalAdj        = adjResult.length > 0 ? adjResult[0].totalAdj : 0;
  const totalMealsCount = Math.max(0, rawMeals + totalAdj);
  const mealRate        = totalMealsCount > 0 ? parseFloat((totalCost / totalMealsCount).toFixed(2)) : 0;

  return { totalCost, totalMealsCount, mealRate };
};

const getUserMonthlyBill = async (userId, startDate, endDate, mealRate) => {
  const month = startDate.getMonth() + 1;
  const year  = startDate.getFullYear();

  const [userMeals, adjResult] = await Promise.all([
    Meal.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), date: { $gte: startDate, $lte: endDate } } },
      { $sort: { updatedAt: -1 } },
      { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } }, totalMeals: { $first: '$totalMeals' } } },
      { $group: { _id: null, totalMeals: { $sum: '$totalMeals' } } },
    ]),
    MealAdjustment.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId), month, year } },
      { $group: { _id: null, totalAdj: { $sum: '$amount' } } },
    ]),
  ]);

  const rawMeals      = userMeals.length > 0 ? userMeals[0].totalMeals : 0;
  const totalAdj      = adjResult.length > 0 ? adjResult[0].totalAdj : 0;
  const totalUserMeals = Math.max(0, rawMeals + totalAdj);
  const foodCost      = parseFloat((totalUserMeals * mealRate).toFixed(2));
  return { totalMeals: totalUserMeals, rawMeals, adjustment: totalAdj, foodCost, mealRate };
};

// Returns a map of userId → total expense amount paid
const getExpenseContributions = async (startDate, endDate, userIds) => {
  const result = await Expense.aggregate([
    { $match: { date: { $gte: startDate, $lte: endDate }, addedBy: { $in: userIds }, paidBy: { $ne: null } } },
    { $group: { _id: '$paidBy', totalPaid: { $sum: '$amount' } } },
  ]);
  const map = {};
  result.forEach(r => { map[r._id.toString()] = r.totalPaid; });
  return map;
};

// Meal usage per month for chart (current year, filtered by mess users)
const getYearlyMealTrend = async (userIds) => {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const result = await Meal.aggregate([
    { $match: { date: { $gte: startOfYear }, user: { $in: userIds } } },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: { user: '$user', day: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: '+06:00' } } }, totalMeals: { $first: '$totalMeals' }, month: { $first: { $month: { date: '$date', timezone: '+06:00' } } } } },
    { $group: { _id: { month: '$month' }, totalMeals: { $sum: '$totalMeals' } } },
    { $sort: { '_id.month': 1 } },
  ]);

  return result.map((r) => ({ month: r._id.month, totalMeals: r.totalMeals }));
};

// Returns total advance paid by a user in a given month
const getUserAdvanceTotal = async (userId, month, year) => {
  const result = await AdvancePayment.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), month, year } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return result.length > 0 ? result[0].total : 0;
};

module.exports = { getMonthlySummary, getUserMonthlyBill, getYearlyMealTrend, getExpenseContributions, getUserAdvanceTotal };
