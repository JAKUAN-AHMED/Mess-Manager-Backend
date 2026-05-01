const AdvancePayment = require('../models/AdvancePayment');
const User = require('../models/User');

// GET /api/advance-payments?month=M&year=Y
exports.getAdvancePayments = async (req, res) => {
  try {
    const { month, year } = req.query;
    const messUserIds = await User.find({ mess: req.user.mess }).distinct('_id');
    const filter = { user: { $in: messUserIds } };
    if (month) filter.month = parseInt(month);
    if (year)  filter.year  = parseInt(year);

    const advances = await AdvancePayment.find(filter)
      .populate('user', 'name phone roomNumber')
      .populate('recordedBy', 'name')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: advances });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/advance-payments
exports.addAdvancePayment = async (req, res) => {
  try {
    const { userId, month, year, amount, note } = req.body;
    if (!userId || !month || !year || amount === undefined || amount <= 0) {
      return res.status(400).json({ success: false, error: 'সব তথ্য সঠিকভাবে দিন' });
    }

    const advance = await AdvancePayment.create({
      user: userId,
      month: parseInt(month),
      year: parseInt(year),
      amount: parseFloat(amount),
      note: note?.trim() || '',
      recordedBy: req.user._id,
    });

    await advance.populate('user', 'name phone roomNumber');
    await advance.populate('recordedBy', 'name');

    res.status(201).json({ success: true, data: advance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/advance-payments/:id
exports.deleteAdvancePayment = async (req, res) => {
  try {
    const advance = await AdvancePayment.findByIdAndDelete(req.params.id);
    if (!advance) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
