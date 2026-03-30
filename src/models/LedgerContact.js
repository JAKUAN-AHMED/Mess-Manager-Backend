const mongoose = require('mongoose');

const ledgerContactSchema = new mongoose.Schema({
  owner:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:   { type: String, required: true, trim: true },
  phone:  { type: String, default: '' },
  note:   { type: String, default: '' },
}, { timestamps: true });

ledgerContactSchema.index({ owner: 1 });

module.exports = mongoose.model('LedgerContact', ledgerContactSchema);
