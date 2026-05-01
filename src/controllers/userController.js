const bcrypt = require('bcryptjs');
const User = require('../models/User');

function generateMemberCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I/L)
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function uniqueMemberCode() {
  let code, exists = true;
  while (exists) {
    code = generateMemberCode();
    exists = await User.findOne({ memberCode: code });
  }
  return code;
}

// GET /api/users?archived=1
//   archived=0 (default) → active members only
//   archived=1            → archived members
//   archived=all          → both
exports.getUsers = async (req, res) => {
  try {
    const messId = req.user.mess;

    // One-time repair: assign any users without a mess to the current admin's mess
    if (messId) {
      await User.updateMany(
        { $or: [{ mess: { $exists: false } }, { mess: null }] },
        { $set: { mess: messId } }
      );
    }

    const archivedParam = String(req.query.archived ?? '0').toLowerCase();
    const filter = { mess: messId };
    if (archivedParam === '1' || archivedParam === 'true') {
      filter.isArchived = true;
    } else if (archivedParam !== 'all') {
      // Default: hide archived members from the active roster
      filter.isArchived = { $ne: true };
    }

    const users = await User.find(filter).select('-password').sort({ name: 1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, phone, email, password, role, roomNumber, canInputMeals } = req.body;
    const exists = await User.findOne({ phone });
    if (exists)
      return res.status(400).json({ success: false, error: 'এই ফোন নম্বরে অ্যাকাউন্ট আছে' });

    const memberCode = role === 'member' ? await uniqueMemberCode() : undefined;
    const user = await User.create({
      name,
      phone,
      email: email?.trim() || '',
      password: password || '1234',
      role,
      roomNumber,
      canInputMeals,
      memberCode,
      mess: req.user.mess,
    });
    const { password: _, ...userObj } = user.toObject();
    res.status(201).json({ success: true, data: userObj });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (typeof updateData.email === 'string') {
      updateData.email = updateData.email.trim().toLowerCase();
    }
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'সদস্য পাওয়া যায়নি' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/users/:id/regenerate-code — admin regenerates a member's login code
exports.regenerateMemberCode = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'সদস্য পাওয়া যায়নি' });
    const memberCode = await uniqueMemberCode();
    user.memberCode = memberCode;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, data: { memberCode } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/users/:id  — soft-delete (archive)
//
// IMPORTANT: We DO NOT hard-delete the document. The user has historical
// meals, payments, expenses, and adjustments tied to their _id. Hard-deleting
// would orphan those records and make every other page (Meals, Billing,
// Expenses, Reports) lose data for that user.
//
// Instead we mark them as archived + inactive:
//  - They disappear from the default active roster
//  - All their historical data continues to populate correctly
//  - Past months' bills can still be generated and emailed
//  - Admins can restore them at any time
exports.deleteUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'সদস্য পাওয়া যায়নি' });

    // Prevent archiving the last active admin
    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({
        role: 'admin',
        isArchived: { $ne: true },
        mess: target.mess,
      });
      if (adminCount <= 1)
        return res.status(400).json({ success: false, error: 'একমাত্র অ্যাডমিনকে মুছে ফেলা যাবে না' });
    }

    target.isArchived = true;
    target.isActive = false;
    target.archivedAt = new Date();
    await target.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'সদস্য আর্কাইভ করা হয়েছে। তার পুরোনো তথ্য সংরক্ষিত আছে।',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/users/:id/restore — bring an archived member back
exports.restoreUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'সদস্য পাওয়া যায়নি' });
    user.isArchived = false;
    user.isActive = true;
    user.archivedAt = null;
    await user.save({ validateBeforeSave: false });
    const { password: _, ...obj } = user.toObject();
    res.json({ success: true, data: obj, message: 'সদস্য পুনরুদ্ধার হয়েছে' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
