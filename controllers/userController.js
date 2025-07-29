const { User } = require('../models/user');
const { getAIModelAndAccess } = require('../utils/subscriptionUtils');

// Find user by Telegram ID or create a new one
async function findOrCreateUser(telegramId) {
  let user = await User.findOne({ telegramId });

  if (!user) {
    user = new User({
      telegramId,
      streak: 0,
      hasCheckedInToday: false,
      trialStartDate: new Date(),
      subscriptionStatus: 'trial',
      usageCount: 0,
    });
    await user.save();
  }

  return user;
}

// Update user data
async function updateUser(telegramId, data) {
  return await User.findOneAndUpdate({ telegramId }, data, { new: true });
}

// Add daily checklist tasks
async function addDailyTasks(user, tasks) {
  const today = new Date().toISOString().split('T')[0];

  if (!user.history) user.history = [];

  user.history.push({
    date: today,
    focus: user.focus,
    tasks,
    checkedIn: false
  });

  user.dailyChecklist = tasks;
  user.hasCheckedInToday = false;
  user.lastCheckInDate = today;

  await user.save();
}

// Get AI model if user has access
async function getAIModel(user) {
  const result = await getAIModelAndAccess(user);
  if (!result.allowed) return { allowed: false, reason: result.reason };

  // Increase usage count only if under trial or basic
  if (user.subscriptionStatus === 'trial' || user.subscriptionPlan === 'basic') {
    user.usageCount += 1;
    user.lastUsageDate = new Date().toISOString().split('T')[0];
    await user.save();
  }

  return { allowed: true, model: result.model };
}

module.exports = {
  findOrCreateUser,
  updateUser,
  addDailyTasks,
  getAIModel
};
