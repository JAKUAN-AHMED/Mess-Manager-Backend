const crypto = require('crypto');
const Mess = require('../models/Mess');

// GET /api/mess — get mess info (admin sees join code)
exports.getMess = async (req, res) => {
  try {
    const mess = await Mess.findOne().populate('admin', 'name phone');
    if (!mess) return res.status(404).json({ success: false, error: 'মেস পাওয়া যায়নি' });
    res.json({ success: true, data: mess });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PUT /api/mess — update mess name
exports.updateMess = async (req, res) => {
  try {
    const { name } = req.body;
    const mess = await Mess.findOneAndUpdate({}, { name }, { new: true });
    res.json({ success: true, data: mess });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/mess/regenerate-code — generate a new join code
exports.regenerateCode = async (req, res) => {
  try {
    const newCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    const mess = await Mess.findOneAndUpdate({}, { joinCode: newCode }, { new: true });
    res.json({ success: true, data: { joinCode: mess.joinCode } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
