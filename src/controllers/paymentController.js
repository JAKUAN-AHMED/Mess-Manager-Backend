const Payment = require('../models/Payment');
const AdvancePayment = require('../models/AdvancePayment');

// POST /api/payments
exports.recordPayment = async (req, res) => {
  try {
    const { userId, month, year, totalBill, paidAmount, isMessOwesMember } = req.body;
    
    let status, advanceAmount;
    
    if (isMessOwesMember) {
      // Mess is paying the member from advance fund
      status = 'পরিশোধিত';
      advanceAmount = 0; // No new advance, we're using existing advance
      
      // Deduct from advance payments
      // Find all advance payments for this user/month/year and reduce them proportionally
      let remainingToDeduct = paidAmount;
      const userAdvances = await AdvancePayment.find({ user: userId, month, year }).sort({ createdAt: 1 });
      
      for (const adv of userAdvances) {
        if (remainingToDeduct <= 0) break;
        
        const deductAmount = Math.min(adv.amount, remainingToDeduct);
        adv.amount -= deductAmount;
        remainingToDeduct -= deductAmount;
        
        if (adv.amount <= 0) {
          await AdvancePayment.deleteOne({ _id: adv._id });
        } else {
          await adv.save();
        }
      }
    } else {
      // Member is paying the mess
      status = paidAmount >= totalBill ? 'পরিশোধিত' : 'বাকি';
      advanceAmount = paidAmount > totalBill ? parseFloat((paidAmount - totalBill).toFixed(2)) : 0;
    }

    const payment = await Payment.findOneAndUpdate(
      { user: userId, month, year },
      { totalBill, paidAmount, advanceAmount, status, paymentDate: new Date() },
      { new: true, upsert: true }
    ).populate('user', 'name phone');

    res.status(200).json({ success: true, data: payment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/payments?month=M&year=Y
exports.getPayments = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = {};
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    const payments = await Payment.find(filter).populate('user', 'name phone roomNumber').sort({ createdAt: -1 });
    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
