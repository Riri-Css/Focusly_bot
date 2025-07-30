const User = require('../models/user');
//const { defaultTasks } = require('../constants');

async function getOrCreateUser(telegramId) {
  try {
    let user = await User.findOne({ telegramId });
    if (!user) {
      user = await User.create({ telegramId });
    }
    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    return null;
  }
}

async function updateUserField(telegramId, field, value) {
  try {
    await User.updateOne({ telegramId }, { [field]: value });
  } catch (error) {
    console.error(`Error updating user field ${field}:`, error);
  }
}

async function incrementStreak(telegramId) {
  try {
    await User.updateOne({ telegramId }, { $inc: { streak: 1 } });
  } catch (error) {
    console.error('Error incrementing streak:', error);
  }
}

async function resetStreak(telegramId) {
  try {
    await User.updateOne({ telegramId }, { streak: 0 });
  } catch (error) {
    console.error('Error resetting streak:', error);
  }
}

async function saveDailyTasks(telegramId, tasks) {
  try {
    const today = new Date().toISOString().split('T')[0];
    await User.updateOne(
      { telegramId },
      { $set: { [`dailyTasks.${today}`]: tasks } }
    );
  } catch (error) {
    console.error('Error saving daily tasks:', error);
  }
}

async function getTodayTasks(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return [];

    const today = new Date().toISOString().split('T')[0];
    return user.dailyTasks?.[today] || [];
  } catch (error) {
    console.error('Error getting today tasks:', error);
    return [];
  }
}

async function markTaskStatus(telegramId, status) {
  try {
    const today = new Date().toISOString().split('T')[0];
    await User.updateOne({ telegramId }, { $set: { [`taskStatus.${today}`]: status } });
  } catch (error) {
    console.error('Error marking task status:', error);
  }
}

async function checkTaskStatus(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    const today = new Date().toISOString().split('T')[0];
    return user?.taskStatus?.[today] || null;
  } catch (error) {
    console.error('Error checking task status:', error);
    return null;
  }
}

async function incrementAIUsage(telegramId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    await User.updateOne(
      { telegramId },
      { $inc: { [`aiUsage.${today}`]: 1 } }
    );
  } catch (error) {
    console.error('Error incrementing AI usage:', error);
  }
}

async function getAIUsage(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    const today = new Date().toISOString().split('T')[0];
    return user?.aiUsage?.[today] || 0;
  } catch (error) {
    console.error('Error getting AI usage:', error);
    return 0;
  }
}

async function resetDailyAIUsage() {
  try {
    const users = await User.find({});
    const today = new Date().toISOString().split('T')[0];

    for (const user of users) {
      user.aiUsage[today] = 0;
      await user.save();
    }
  } catch (error) {
    console.error('Error resetting daily AI usage:', error);
  }
}

async function getUserGoal(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    return user?.goal || null;
  } catch (error) {
    console.error('Error getting user goal:', error);
    return null;
  }
}

module.exports = {
  getOrCreateUser,
  updateUserField,
  incrementStreak,
  resetStreak,
  saveDailyTasks,
  getTodayTasks,
  markTaskStatus,
  checkTaskStatus,
  incrementAIUsage,
  getAIUsage,
  resetDailyAIUsage,
  getUserGoal
};
