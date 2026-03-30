const mongoose = require('mongoose');

const mealAdjustmentSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  month:     { type: Number, required: true },
  year:      { type: Number, required: true },
  amount:    { type: Number, required: true }, // negative = deduction, positive = addition
  reason:    { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('MealAdjustment', mealAdjustmentSchema);
