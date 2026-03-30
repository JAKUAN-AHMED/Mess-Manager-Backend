const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GET /api/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ name: 1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/users
exports.createUser = async (req, res) => {
  try {
    const { name, phone, password, role, roomNumber, canInputMeals } = req.body;
    const exists = await User.findOne({ phone });
    if (exists)
      return res.status(400).json({ success: false, error: 'এই ফোন নম্বরে অ্যাকাউন্ট আছে' });

    const user = await User.create({ name, phone, password: password || '1234', role, roomNumber, canInputMeals });
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
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, error: 'সদস্য পাওয়া যায়নি' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/users/:id  — hard delete
exports.deleteUser = async (req, res) => {
  try {
    // Prevent deleting the last admin
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, error: 'সদস্য পাওয়া যায়নি' });
    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1)
        return res.status(400).json({ success: false, error: 'একমাত্র অ্যাডমিনকে মুছে ফেলা যাবে না' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'সদস্য মুছে ফেলা হয়েছে' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
