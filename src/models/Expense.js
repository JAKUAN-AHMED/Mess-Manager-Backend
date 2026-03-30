const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  addedByName: { type: String, default: '' },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, enum: ['বাজার', 'গ্যাস', 'বেতন', 'অন্যান্য'], required: true },
  description: { type: String },
  items: [{
    name:     { type: String, required: true },
    quantity: { type: Number, default: null },
    price:    { type: Number, required: true, min: 0 },
  }],
}, { timestamps: true });

expenseSchema.index({ date: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
