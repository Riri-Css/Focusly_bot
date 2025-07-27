const User = require('../models/User');

async function findOrCreateUser(telegramId) {
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = await User.create({ telegramId, stage: 'awaiting_name' });
  }
  return user;
}

async function updateUserStageAndFocus(user, name, focus) {
  user.name = name || user.name;
  user.focus = focus || user.focus;
  user.stage = 'awaiting_tasks';
  await user.save();
}

async function addDailyTasks(user, tasksArray) {
  const today = new Date();
  const formattedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const tasksToAdd = tasksArray.map(task => ({
    content: task,
    date: formattedDate,
    completed: false,
  }));

  user.dailyTasks.push(...tasksToAdd);
  user.stage = 'completed_onboarding';
  await user.save();
}

module.exports = {
  findOrCreateUser,
  updateUserStageAndFocus,
  addDailyTasks
};
