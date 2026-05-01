const Meal = require('../models/Meal');
const User = require('../models/User');

// POST /api/meals — add or update a daily meal entry
exports.addOrUpdateMeal = async (req, res) => {
  try {
    const { userId, date, breakfast, lunch, dinner } = req.body;
    const totalMeals = (breakfast || 0) + (lunch || 0) + (dinner || 0);
    // Normalize to UTC midnight to avoid timezone-based duplicate documents
    const [y, m, d] = String(date).slice(0, 10).split('-').map(Number);
    const mealDate = new Date(Date.UTC(y, m - 1, d));

    const meal = await Meal.findOneAndUpdate(
      { user: userId, date: mealDate },
      { breakfast: breakfast || 0, lunch: lunch || 0, dinner: dinner || 0, totalMeals },
      { new: true, upsert: true, runValidators: true }
    ).populate('user', 'name phone');

    res.status(200).json({ success: true, data: meal, message: 'মিল সফলভাবে সেভ হয়েছে' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/meals?month=M&year=Y&userId=id
exports.getMeals = async (req, res) => {
  try {
    const { month, year, userId } = req.query;
    const filter = {};

    if (month && year) {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end   = new Date(Date.UTC(year, month,     0, 23, 59, 59));
      filter.date = { $gte: start, $lte: end };
    }

    if (userId) {
      filter.user = userId;
    } else {
      const messId = req.user.mess;
      if (messId) {
        await User.updateMany(
          { $or: [{ mess: { $exists: false } }, { mess: null }] },
          { $set: { mess: messId } }
        );
      }
      const messUserIds = await User.find({ mess: messId }).distinct('_id');
      filter.user = { $in: messUserIds };
    }

    const meals = await Meal.find(filter)
      .populate('user', 'name phone roomNumber')
      .sort({ date: -1 });

    res.json({ success: true, data: meals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/meals/:id
exports.deleteMeal = async (req, res) => {
  try {
    const meal = await Meal.findByIdAndDelete(req.params.id);
    if (!meal) return res.status(404).json({ success: false, error: 'মিল পাওয়া যায়নি' });
    res.json({ success: true, message: 'মিল মুছে ফেলা হয়েছে' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
