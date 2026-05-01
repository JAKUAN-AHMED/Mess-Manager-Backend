const mongoose = require('mongoose');

/**
 * Idempotency record for the monthly billing email job.
 *
 * One document per (mess, month, year) — created the first time the job
 * sends bills for a given mess in a given month. The cron endpoint checks
 * for the document and refuses to re-send unless `force` is requested.
 */
const billingEmailLogSchema = new mongoose.Schema({
  mess:    { type: mongoose.Schema.Types.ObjectId, ref: 'Mess', required: true },
  month:   { type: Number, required: true, min: 1, max: 12 },
  year:    { type: Number, required: true },
  sentAt:  { type: Date, default: Date.now },
  sentCount:    { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  triggeredBy:  { type: String, enum: ['cron', 'manual'], default: 'cron' },
}, { timestamps: true });

billingEmailLogSchema.index({ mess: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('BillingEmailLog', billingEmailLogSchema);
