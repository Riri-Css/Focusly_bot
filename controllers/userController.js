const User = require('../models/user');

// Find user or create a new one
async function findOrCreateUser(telegramId) {
  let user = await User.findOne({ telegramId });

  if (!user) {
    user = new User({
      telegramId,
      trialStartDate: new Date(),
      subscriptionStatus: 'trial',
      usageCount: 0,
      usageDate: new Date(),
    });
    await user.save();
  }

  return user;
}

// Update user
async function updateUser(telegramId, data) {
  return await User.findOneAndUpdate({ telegramId }, data, { new: true });
}

// Add daily checklist
async function addDailyTasks(user, taskInput) {
  const today = new Date().toISOString().split('T')[0];
  const tasks = typeof taskInput === 'string'
    ? taskInput.split(',').map(task => task.trim())
    : taskInput;

  user.history = user.history || [];

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

// Increment usage and auto-reset when needed
async function incrementAIUsage(user) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (!user.usageDate) {
    user.usageDate = now;
    user.usageCount = 0;
  }

  const isTrial = user.subscriptionStatus === 'trial';
  const isBasic = user.subscriptionStatus === 'subscribed' && user.subscriptionPlan === 'basic';

  const usageDate = new Date(user.usageDate);
  const sameDay = usageDate.toISOString().split('T')[0] === today;

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay()); // Sunday as start of week

  const sameWeek = usageDate >= weekStart;

  if ((isTrial && !sameDay) || (isBasic && !sameWeek)) {
    user.usageCount = 0;
  }

  user.usageDate = now;
  user.usageCount += 1;

  await user.save();
}

module.exports = {
  findOrCreateUser,
  updateUser,
  addDailyTasks,
  incrementAIUsage
};
