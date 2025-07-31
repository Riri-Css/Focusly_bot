const User = require('../models/user');
const { getCurrentModelForUser } = require('../utils/subscriptionUtils');

async function getOrCreateUser(telegramId, username) {
  let user = await User.findOne({ telegramId });

  if (!user) {
    user = new User({
      telegramId,
      username,
      onboardingStep: 'start',
      tasks: [],
      streak: 0,
      lastCheckInDate: null,
      trialStartDate: new Date(),
      aiUsage: {
        dailyUses: 0,
        weeklyUses: 0,
        lastUsedDate: null
      }
    });
    await user.save();
  }

  return user;
}

// ✅ FIX: Add this missing function
async function getUserByTelegramId(telegramId) {
  return await User.findOne({ telegramId });
}

async function updateUser(telegramId, update) {
  return await User.findOneAndUpdate({ telegramId }, update, { new: true });
}

async function resetDailyUsageIfNeeded(user) {
  const today = new Date().toDateString();
  const lastUsed = user.aiUsage?.lastUsedDate?.toDateString();

  if (today !== lastUsed) {
    user.aiUsage.dailyUses = 0;
    user.aiUsage.lastUsedDate = new Date();
    await user.save();
  }
}

async function resetWeeklyUsageIfNeeded(user) {
  const now = new Date();
  const currentWeek = getWeekNumber(now);
  const lastUsed = user.aiUsage?.lastUsedDate;

  if (!lastUsed || getWeekNumber(lastUsed) !== currentWeek) {
    user.aiUsage.weeklyUses = 0;
    user.aiUsage.lastUsedDate = new Date();
    await user.save();
  }
}

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
}

async function hasAIUsageAccess(user, type = 'general') {
  const now = new Date();
  const trialEnds = new Date(user.trialStartDate);
  trialEnds.setDate(trialEnds.getDate() + 14);

  const isTrialActive = now <= trialEnds;
  const isSubscribed = user.subscription && user.subscription.status === 'active';

  await resetDailyUsageIfNeeded(user);
  await resetWeeklyUsageIfNeeded(user);

  const usage = user.aiUsage || { dailyUses: 0, weeklyUses: 0 };

  // Premium plan: unlimited
  if (user.subscription?.plan === 'premium' && isSubscribed) return true;

  // Trial: 5 daily uses
  if (isTrialActive && usage.dailyUses < 5) return true;

  // Basic: 10 weekly checklist-only uses
  if (user.subscription?.plan === 'basic' && isSubscribed) {
    if (type === 'checklist' && usage.weeklyUses < 10) return true;
    return false; // basic can't use general AI
  }

  return false;
}

async function incrementAIUsage(user, type = 'general') {
  await resetDailyUsageIfNeeded(user);
  await resetWeeklyUsageIfNeeded(user);

  if (user.trialStartDate) {
    user.aiUsage.dailyUses += 1;
  } else if (user.subscription?.plan === 'basic' && type === 'checklist') {
    user.aiUsage.weeklyUses += 1;
  } else if (user.subscription?.plan === 'premium') {
    // Premium has unlimited access, no increment needed
  }

  user.aiUsage.lastUsedDate = new Date();
  await user.save();
}

async function getModelForUser(user) {
  return getCurrentModelForUser(user); // picks gpt-3.5 or gpt-4o
}

module.exports = {
  getOrCreateUser,
  getUserByTelegramId, // ✅ EXPORT FIXED HERE
  updateUser,
  hasAIUsageAccess,
  incrementAIUsage,
  getModelForUser
};
