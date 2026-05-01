const Expense = require('../models/Expense');
const User = require('../models/User');

// POST /api/expenses
exports.addExpense = async (req, res) => {
  try {
    const { date, category, description, items, addedByName, paidBy } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ success: false, error: 'কমপক্ষে একটি আইটেম যোগ করুন' });

    // Total = sum of (price × quantity) for each item; quantity defaults to 1
    const totalAmount = items.reduce((sum, item) => {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      return sum + item.price * qty;
    }, 0);

    const expense = await Expense.create({
      addedBy: req.user._id,
      addedByName: addedByName ? addedByName.trim() : '',
      paidBy: paidBy || null,
      date: date ? new Date(date) : new Date(),
      amount: totalAmount,
      category,
      description,
      items,
    });
    await expense.populate('addedBy', 'name');
    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/expenses?month=M&year=Y
exports.getExpenses = async (req, res) => {
  try {
    const { month, year } = req.query;
    const messId = req.user.mess;
    if (messId) {
      await User.updateMany(
        { $or: [{ mess: { $exists: false } }, { mess: null }] },
        { $set: { mess: messId } }
      );
    }
    const messUserIds = await User.find({ mess: messId }).distinct('_id');
    const filter = { addedBy: { $in: messUserIds } };
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      filter.date = { $gte: start, $lte: end };
    }
    const expenses = await Expense.find(filter).populate('addedBy', 'name').sort({ date: -1 });
    res.json({ success: true, data: expenses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/expenses/:id
exports.updateExpense = async (req, res) => {
  try {
    const { date, category, description, items, addedByName, paidBy } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ success: false, error: 'কমপক্ষে একটি আইটেম যোগ করুন' });

    const totalAmount = items.reduce((sum, item) => {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      return sum + item.price * qty;
    }, 0);

    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      { date: date ? new Date(date) : undefined, category, description, items, amount: totalAmount, addedByName: addedByName || '', paidBy: paidBy || null },
      { new: true, runValidators: true }
    ).populate('addedBy', 'name');

    if (!expense) return res.status(404).json({ success: false, error: 'খরচ পাওয়া যায়নি' });
    res.json({ success: true, data: expense });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/expenses/:id
exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ success: false, error: 'খরচ পাওয়া যায়নি' });
    res.json({ success: true, message: 'খরচ মুছে ফেলা হয়েছে' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
