const mongoose = require('mongoose');
const crypto = require('crypto');

const messSchema = new mongoose.Schema({
  name: { type: String, required: true },
  joinCode: { type: String, unique: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

messSchema.pre('save', function () {
  if (!this.joinCode) {
    this.joinCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A1B2C3"
  }
});

module.exports = mongoose.model('Mess', messSchema);
