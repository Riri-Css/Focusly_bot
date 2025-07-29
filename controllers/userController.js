const User = require('../models/user');

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
    });

    await user.save();
  }

  return user;
}

// Update user data
async function updateUser(telegramId, data) {
  return await User.findOneAndUpdate({ telegramId }, data, { new: true });
}

// Add daily checklist tasks (expects comma-separated string input)
async function addDailyTasks(user, taskInput) {
  const today = new Date().toISOString().split('T')[0];
  let tasks = [];
  // Clean and split task input string into array
  if (typeof taskInput === 'string') {
    tasks = taskInput
      .split(',')
      .map(task => task.trim())
      .filter(task => task.length > 0); // Remove empty entries
  } else if (Array.isArray(taskInput)) {
    tasks = taskInput.map(task => String(task).trim()).filter(task => task.length > 0);
  } else {
    throw new Error('Invalid task input format. Expected a string or an array.');
  }

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

module.exports = {
  findOrCreateUser,
  updateUser,
  addDailyTasks,
};
