const LedgerContact     = require('../models/LedgerContact');
const LedgerTransaction = require('../models/LedgerTransaction');
const LedgerShare       = require('../models/LedgerShare');

/* ── Contacts ─────────────────────────────────────────── */

// GET /api/ledger/contacts  — list all contacts + their net balance (owned + shared)
exports.getContacts = async (req, res) => {
  try {
    // Get owned contacts
    const ownedContacts = await LedgerContact.find({ owner: req.user._id }).sort({ name: 1 });
    
    // Get shared contacts
    const sharedContactsRaw = await LedgerShare.find({ sharedWith: req.user._id })
      .populate('contact')
      .sort({ createdAt: -1 });
    
    // Mark owned contacts
    const ownedContactsMarked = ownedContacts.map(c => ({
      ...c.toObject(),
      isOwner: true,
      canEdit: true,
    }));
    
    // Mark shared contacts
    const sharedContactsMarked = sharedContactsRaw.map(share => ({
      ...share.contact.toObject(),
      isOwner: false,
      canEdit: share.canEdit,
    }));
    
    // Combine both
    const allContacts = [...ownedContactsMarked, ...sharedContactsMarked];

    // Calculate balances for all contacts
    const POSITIVE_TYPES = ['lent', 'paid_back', 'gave'];

    // For owned contacts - use owner's transactions
    const ownedAgg = await LedgerTransaction.aggregate([
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

    // For shared contacts - calculate balance from shared user's perspective
    // The owner's "lent" means the shared user "borrowed" (opposite view)
    const NEGATIVE_TYPES_FOR_SHARED = ['lent', 'paid_back', 'gave']; // owner's positive = shared user's negative
    const POSITIVE_TYPES_FOR_SHARED = ['borrowed', 'received_back', 'received']; // owner's negative = shared user's positive
    
    const sharedContactIds = sharedContactsRaw.map(s => s.contact._id);
    const sharedAgg = sharedContactIds.length > 0 ? await LedgerTransaction.aggregate([
      { $match: { contact: { $in: sharedContactIds } } },
      {
        $group: {
          _id: '$contact',
          balance: {
            $sum: {
              // For shared users, flip the logic: owner's lent = shared user's borrowed (negative)
              $cond: [
                { $in: ['$type', POSITIVE_TYPES_FOR_SHARED] }, 
                '$amount', 
                { $multiply: ['$amount', -1] }
              ],
            },
          },
        },
      },
    ]) : [];
    
    const ownedBalanceMap = {};
    ownedAgg.forEach(a => { ownedBalanceMap[a._id.toString()] = a.balance; });
    
    const sharedBalanceMap = {};
    sharedAgg.forEach(a => { sharedBalanceMap[a._id.toString()] = a.balance; });

    const data = allContacts.map(c => ({
      ...c,
      balance: parseFloat((ownedBalanceMap[c._id.toString()] || sharedBalanceMap[c._id.toString()] || 0).toFixed(2)),
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
    
    // Check if user owns the contact or has edit permission
    const contact = await LedgerContact.findOne({ _id: req.params.id });
    if (!contact) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });
    
    // Check if user is owner or has edit access
    const isOwner = contact.owner.toString() === req.user._id.toString();
    const hasEditAccess = isOwner || (contact.sharedWith && contact.sharedWith.some(id => id.toString() === req.user._id.toString()));
    
    // For now, only owner can update contact details
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'শুধুমাত্র মালিক আপডেট করতে পারবে' });
    }
    
    const updatedContact = await LedgerContact.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { name: name?.trim(), phone, note },
      { new: true }
    );
    if (!updatedContact) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });
    res.json({ success: true, data: updatedContact });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/ledger/contacts/:id  — also deletes all transactions
exports.deleteContact = async (req, res) => {
  try {
    // Only owner can delete
    const contact = await LedgerContact.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!contact) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });
    
    // Delete all transactions for this contact
    await LedgerTransaction.deleteMany({ contact: req.params.id });
    
    // Delete all share records
    await LedgerShare.deleteMany({ contact: req.params.id });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ── Transactions ─────────────────────────────────────── */

// GET /api/ledger/contacts/:id/transactions
exports.getTransactions = async (req, res) => {
  try {
    // Check if user has access to this contact (owner or shared)
    const contact = await LedgerContact.findOne({ _id: req.params.id });
    if (!contact) return res.status(404).json({ success: false, error: 'পাওয়া যায়নি' });

    const isOwner = contact.owner.toString() === req.user._id.toString();
    const hasAccess = isOwner || (contact.sharedWith && contact.sharedWith.some(id => id.toString() === req.user._id.toString()));

    if (!hasAccess) {
      return res.status(403).json({ success: false, error: 'অ্যাক্সেস নেই' });
    }

    const txns = await LedgerTransaction.find({
      contact: req.params.id,
    }).sort({ date: 1, createdAt: 1 });

    // For shared users, flip transaction types to show from their perspective
    const TYPE_FLIP = {
      lent: 'borrowed',
      borrowed: 'lent',
      paid_back: 'received_back',
      received_back: 'paid_back',
      gave: 'received',
      received: 'gave',
    };

    const transformedTxns = txns.map(t => {
      const txnObj = t.toObject();
      if (!isOwner) {
        txnObj.type = TYPE_FLIP[txnObj.type] || txnObj.type;
        txnObj.isFromOwnerPerspective = false;
      } else {
        txnObj.isFromOwnerPerspective = true;
      }
      return txnObj;
    });

    res.json({ success: true, data: transformedTxns });
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

    // Check if user has access to this contact
    const contact = await LedgerContact.findOne({ _id: contactId });
    if (!contact) return res.status(404).json({ success: false, error: 'যোগাযোগ পাওয়া যায়নি' });
    
    const isOwner = contact.owner.toString() === req.user._id.toString();
    
    // For now, only owner can add transactions
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'শুধুমাত্র মালিক লেনদেন যোগ করতে পারবে' });
    }

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

    // Only owner can update transactions
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
