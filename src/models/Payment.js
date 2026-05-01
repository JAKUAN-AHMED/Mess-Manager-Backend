const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  totalBill: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['পরিশোধিত', 'বাকি'], default: 'বাকি' },
  paymentDate: { type: Date },
}, { timestamps: true });

paymentSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payment', paymentSchema);
