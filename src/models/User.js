const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  canInputMeals: { type: Boolean, default: false },
  roomNumber: { type: String },
  joinDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  advancedPayment: { type: Number, default: 0 },
  mess: { type: mongoose.Schema.Types.ObjectId, ref: 'Mess' },
}, { timestamps: true });

userSchema.index({ phone: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
