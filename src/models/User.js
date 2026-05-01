const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, lowercase: true, trim: true, default: '' },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'member'], default: 'member' },
  canInputMeals: { type: Boolean, default: false },
  roomNumber: { type: String },
  joinDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  // Soft-delete: when true the user is "removed" from the active roster but
  // all historical meals/expenses/payments stay intact for audits & past bills.
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
  advancedPayment: { type: Number, default: 0 },
  memberCode: { type: String, unique: true, sparse: true },
  mess: { type: mongoose.Schema.Types.ObjectId, ref: 'Mess' },
}, { timestamps: true });

userSchema.index({ phone: 1 });
userSchema.index({ mess: 1, isArchived: 1 });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
