const LedgerContact = require('../models/LedgerContact');
const LedgerShare = require('../models/LedgerShare');
const User = require('../models/User');

/* ── Sharing Management ─────────────────────────────────── */

// POST /api/ledger/share
exports.shareContact = async (req, res) => {
  try {
    const { contactId, userId, canEdit } = req.body;
    
    if (!contactId || !userId) {
      return res.status(400).json({ success: false, error: 'Contact ID এবং User ID দিন' });
    }

    // Verify contact exists and user is the owner
    const contact = await LedgerContact.findOne({ _id: contactId, owner: req.user._id });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'যোগাযোগ পাওয়া যায়নি বা আপনার অ্যাক্সেস নেই' });
    }

    // Verify user to share with exists
    const userToShare = await User.findById(userId);
    if (!userToShare) {
      return res.status(404).json({ success: false, error: 'ব্যবহারকারী পাওয়া যায়নি' });
    }

    // Cannot share with yourself
    if (userId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'নিজের সাথে শেয়ার করতে পারবেন না' });
    }

    // Check if already shared
    const existingShare = await LedgerShare.findOne({ contact: contactId, sharedWith: userId });
    if (existingShare) {
      return res.status(400).json({ success: false, error: 'ইতিমধ্যে শেয়ার করা আছে' });
    }

    // Create share record
    const share = await LedgerShare.create({
      contact: contactId,
      sharedBy: req.user._id,
      sharedWith: userId,
      canEdit: canEdit || false,
    });

    // Update contact's sharedWith array
    if (!contact.sharedWith.includes(userId)) {
      contact.sharedWith.push(userId);
      await contact.save();
    }

    res.status(201).json({ success: true, data: share });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/ledger/share/:contactId/:userId
exports.unshareContact = async (req, res) => {
  try {
    const { contactId, userId } = req.params;

    // Verify contact exists and user is the owner
    const contact = await LedgerContact.findOne({ _id: contactId, owner: req.user._id });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'যোগাযোগ পাওয়া যায়নি বা আপনার অ্যাক্সেস নেই' });
    }

    // Remove share record
    await LedgerShare.deleteOne({ contact: contactId, sharedWith: userId });

    // Update contact's sharedWith array
    contact.sharedWith = contact.sharedWith.filter(id => id.toString() !== userId);
    await contact.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/ledger/share/:contactId/users
exports.getSharedUsers = async (req, res) => {
  try {
    const { contactId } = req.params;

    // Verify contact exists and user is the owner
    const contact = await LedgerContact.findOne({ _id: contactId, owner: req.user._id });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'যোগাযোগ পাওয়া যায়নি বা আপনার অ্যাক্সেস নেই' });
    }

    // Get all shared users
    const shares = await LedgerShare.find({ contact: contactId })
      .populate('sharedWith', 'name phone')
      .sort({ createdAt: -1 });

    const sharedUsers = shares.map(share => ({
      user: share.sharedWith,
      canEdit: share.canEdit,
      sharedAt: share.createdAt,
    }));

    res.json({ success: true, data: sharedUsers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/ledger/shared-with-me
exports.getSharedWithMe = async (req, res) => {
  try {
    // Get all contacts shared with current user
    const shares = await LedgerShare.find({ sharedWith: req.user._id })
      .populate('contact')
      .sort({ createdAt: -1 });

    const contacts = shares.map(share => ({
      ...share.contact.toObject(),
      sharedBy: share.sharedBy,
      canEdit: share.canEdit,
      isShared: true,
    }));

    res.json({ success: true, data: contacts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/ledger/search-users
exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'অন্তত ২ অক্ষর লিখুন' });
    }

    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } },
      ],
    })
    .select('name phone')
    .limit(10);

    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
