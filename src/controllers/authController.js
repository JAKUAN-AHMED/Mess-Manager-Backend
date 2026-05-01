const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User   = require('../models/User');
const Mess   = require('../models/Mess');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const userPayload = (user, token) => ({
  _id: user._id,
  name: user.name,
  phone: user.phone,
  role: user.role,
  canInputMeals: user.canInputMeals,
  mess: user.mess,
  token,
});

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ success: false, error: 'ফোন ও পাসওয়ার্ড দিন' });

    const user = await User.findOne({ phone });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, error: 'ফোন বা পাসওয়ার্ড ভুল' });

    if (user.isArchived)
      return res.status(403).json({ success: false, error: 'এই অ্যাকাউন্ট আর্কাইভ করা হয়েছে' });
    if (!user.isActive)
      return res.status(403).json({ success: false, error: 'অ্যাকাউন্ট নিষ্ক্রিয়' });

    res.json({ success: true, data: userPayload(user, generateToken(user._id)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/auth/register-manager — manager creates their own account + mess
exports.registerManager = async (req, res) => {
  try {
    const { name, phone, password, messName } = req.body;
    if (!name || !phone || !password || !messName)
      return res.status(400).json({ success: false, error: 'সব তথ্য পূরণ করুন' });

    const phoneExists = await User.findOne({ phone });
    if (phoneExists)
      return res.status(400).json({ success: false, error: 'এই ফোন নম্বরে অ্যাকাউন্ট আছে' });

    // Create manager account
    const manager = await User.create({
      name,
      phone,
      password,
      role: 'admin',
      canInputMeals: true,
    });

    // Create mess linked to this manager
    const mess = await Mess.create({ name: messName, admin: manager._id });

    // Link manager to mess
    manager.mess = mess._id;
    await manager.save();

    res.status(201).json({
      success: true,
      data: {
        user: userPayload(manager, generateToken(manager._id)),
        mess: { _id: mess._id, name: mess.name, joinCode: mess.joinCode },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/auth/signup — member joins using a mess join code
exports.signup = async (req, res) => {
  try {
    const { name, phone, password, joinCode, roomNumber } = req.body;
    if (!name || !phone || !password || !joinCode)
      return res.status(400).json({ success: false, error: 'সব তথ্য পূরণ করুন' });

    const mess = await Mess.findOne({ joinCode: joinCode.toUpperCase() });
    if (!mess)
      return res.status(400).json({ success: false, error: 'মেস কোড সঠিক নয়' });

    if (!mess.isActive)
      return res.status(400).json({ success: false, error: 'এই মেসে এখন যোগ দেওয়া যাচ্ছে না' });

    const phoneExists = await User.findOne({ phone });
    if (phoneExists)
      return res.status(400).json({ success: false, error: 'এই ফোন নম্বরে অ্যাকাউন্ট আছে' });

    const user = await User.create({
      name,
      phone,
      password,
      roomNumber,
      role: 'member',
      canInputMeals: false,
      mess: mess._id,
    });

    res.status(201).json({
      success: true,
      data: userPayload(user, generateToken(user._id)),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id).select('-password').populate('mess', 'name joinCode');
  res.json({ success: true, data: user });
};

// POST /api/auth/member-login — member logs in with their unique code
exports.memberCodeLogin = async (req, res) => {
  try {
    const { memberCode } = req.body;
    if (!memberCode)
      return res.status(400).json({ success: false, error: 'মেম্বার কোড দিন' });

    const user = await User.findOne({ memberCode: memberCode.toUpperCase().trim() });
    if (!user)
      return res.status(401).json({ success: false, error: 'কোডটি সঠিক নয়' });

    if (user.isArchived)
      return res.status(403).json({ success: false, error: 'এই অ্যাকাউন্ট আর্কাইভ করা হয়েছে' });
    if (!user.isActive)
      return res.status(403).json({ success: false, error: 'অ্যাকাউন্ট নিষ্ক্রিয়' });

    res.json({ success: true, data: userPayload(user, generateToken(user._id)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/auth/forgot-password  (public — verified via phone + mess join code)
exports.forgotPassword = async (req, res) => {
  try {
    const { phone, joinCode, newPassword } = req.body;
    if (!phone || !joinCode || !newPassword)
      return res.status(400).json({ success: false, error: 'সব তথ্য পূরণ করুন' });

    if (newPassword.length < 4)
      return res.status(400).json({ success: false, error: 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষর হতে হবে' });

    // Find user
    const user = await User.findOne({ phone });
    if (!user)
      return res.status(404).json({ success: false, error: 'এই ফোন নম্বরে কোনো অ্যাকাউন্ট নেই' });

    // Verify join code against user's mess
    const mess = await Mess.findById(user.mess);
    if (!mess || mess.joinCode.toUpperCase() !== joinCode.trim().toUpperCase())
      return res.status(400).json({ success: false, error: 'মেস কোড সঠিক নয়' });

    // Update password (hashed)
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/auth/change-password  (protected — for logged-in users)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, error: 'সব তথ্য পূরণ করুন' });

    if (newPassword.length < 4)
      return res.status(400).json({ success: false, error: 'নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষর হতে হবে' });

    // Fetch with password field
    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(currentPassword)))
      return res.status(400).json({ success: false, error: 'বর্তমান পাসওয়ার্ড ভুল' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
