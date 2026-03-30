const LedgerContact     = require('../models/LedgerContact');
const LedgerTransaction = require('../models/LedgerTransaction');

/* ── Contacts ─────────────────────────────────────────── */

// GET /api/ledger/contacts  — list all contacts + their net balance
exports.getContacts = async (req, res) => {
  try {
    const contacts = await LedgerContact.find({ owner: req.user._id }).sort({ name: 1 });

    // Positive types: lent, paid_back, gave → they owe me / I owe less
    // Negative types: borrowed, received_back, received → I owe them / they owe me less
    const POSITIVE_TYPES = ['lent', 'paid_back', 'gave'];
    const agg = await LedgerTransaction.aggregate([
      { $match: { owner: req.user._id } },
      {
        $group: {
          _id: '$contact',
          balance: {
            $sum: {
              $cond: [{ $in: ['$type', POSITIVE_TYPES] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]);
    const balanceMap = {};
    agg.forEach(a => { balanceMap[a._id.toString()] = a.balance; });

    const data = contacts.map(c => ({
      ...c.toObject(),
      balance: parseFloat((balanceMap[c._id.toString()] || 0).toFixed(2)),
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/ledger/contacts
exports.createContact = async (req, res) => {
  try {
    const { name, phone, note } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'নাম দিন' });
    const contact = await LedgerContact.create({ owner: req.user._id, name: name.trim(), phone, note });
    res.status(201).json({ success: true, data: { ...contact.toObject(), balance: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/ledger/contacts/:id
exports.updateContact = async (req, res) => {
  try {
    const { name, phone, note } = req.body;
    const contact = await LedgerContact.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { name: name?.trim(), phone, note },
      { new: true }
    );
    if (!contact) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });
    res.json({ success: true, data: contact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/ledger/contacts/:id  — also deletes all transactions
exports.deleteContact = async (req, res) => {
  try {
    const contact = await LedgerContact.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!contact) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });
    await LedgerTransaction.deleteMany({ contact: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── Transactions ─────────────────────────────────────── */

// GET /api/ledger/contacts/:id/transactions
exports.getTransactions = async (req, res) => {
  try {
    const txns = await LedgerTransaction.find({
      owner: req.user._id,
      contact: req.params.id,
    }).sort({ date: 1, createdAt: 1 });
    res.json({ success: true, data: txns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/ledger/transactions
exports.addTransaction = async (req, res) => {
  try {
    const { contactId, type, amount, note, date } = req.body;
    if (!['lent', 'borrowed', 'received_back', 'paid_back', 'gave', 'received'].includes(type))
      return res.status(400).json({ success: false, error: 'অবৈধ ধরন' });
    if (!amount || amount <= 0)
      return res.status(400).json({ success: false, error: 'পরিমাণ দিন' });

    const contact = await LedgerContact.findOne({ _id: contactId, owner: req.user._id });
    if (!contact) return res.status(404).json({ success: false, error: 'যোগাযোগ পাওয়া যায়নি' });

    const txn = await LedgerTransaction.create({
      owner: req.user._id,
      contact: contactId,
      type,
      amount: parseFloat(amount),
      note: note || '',
      date: date ? new Date(date) : new Date(),
    });
    res.status(201).json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/ledger/transactions/:id
exports.updateTransaction = async (req, res) => {
  try {
    const { type, amount, note, date } = req.body;
    if (!['lent', 'borrowed', 'received_back', 'paid_back', 'gave', 'received'].includes(type))
      return res.status(400).json({ success: false, error: 'অবৈধ ধরন' });
    if (!amount || amount <= 0)
      return res.status(400).json({ success: false, error: 'পরিমাণ দিন' });

    const txn = await LedgerTransaction.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { type, amount: parseFloat(amount), note: note || '', date: date ? new Date(date) : undefined },
      { new: true }
    );
    if (!txn) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });
    res.json({ success: true, data: txn });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/ledger/transactions/:id
exports.deleteTransaction = async (req, res) => {
  try {
    const txn = await LedgerTransaction.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!txn) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
