const mongoose = require('mongoose');

// Positive types (+balance, they owe me more / I owe less):
//   'lent'          → ধার দিয়েছি   (I lent money)
//   'paid_back'     → ফেরত দিয়েছি  (I paid back what I owed)
// Negative types (-balance, I owe them more / they owe me less):
//   'borrowed'      → ধার নিয়েছি   (I borrowed money)
//   'received_back' → ফেরত পেয়েছি  (I received back what they owed)
const ledgerTransactionSchema = new mongoose.Schema({
  owner:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerContact', required: true },
  type:    { type: String, enum: ['lent', 'borrowed', 'received_back', 'paid_back', 'gave', 'received'], required: true },
  amount:  { type: Number, required: true, min: 0.01 },
  note:    { type: String, default: '' },
  date:    { type: Date, default: Date.now },
}, { timestamps: true });

ledgerTransactionSchema.index({ owner: 1, contact: 1 });

module.exports = mongoose.model('LedgerTransaction', ledgerTransactionSchema);
