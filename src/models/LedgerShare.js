const mongoose = require('mongoose');

const ledgerShareSchema = new mongoose.Schema({
  contact: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerContact', required: true },
  sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sharedWith: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  canEdit: { type: Boolean, default: false },
}, { timestamps: true });

ledgerShareSchema.index({ contact: 1, sharedWith: 1 }, { unique: true });
ledgerShareSchema.index({ sharedWith: 1 });

module.exports = mongoose.model('LedgerShare', ledgerShareSchema);
