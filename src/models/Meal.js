const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  breakfast: { type: Number, default: 0, min: 0 },
  lunch: { type: Number, default: 0, min: 0 },
  dinner: { type: Number, default: 0, min: 0 },
  totalMeals: { type: Number, default: 0 },
}, { timestamps: true });

mealSchema.index({ date: 1, user: 1 }, { unique: true });

mealSchema.pre('save', function () {
  this.totalMeals = this.breakfast + this.lunch + this.dinner;
});

module.exports = mongoose.model('Meal', mealSchema);
