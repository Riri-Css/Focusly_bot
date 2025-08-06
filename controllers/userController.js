// File: src/controllers/userController.js
const User = require('../models/user');
const { getCurrentModelForUser } = require('../utils/subscriptionUtils');

// Create or retrieve existing user
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

// Find user by Telegram ID
async function getUserByTelegramId(telegramId) {
  return await User.findOne({ telegramId });
}

// Update user details
async function updateUser(telegramId, update) {
  return await User.findOneAndUpdate({ telegramId }, update, { new: true });
}

// Update any field(s) in the user document
const updateUserField = async (telegramId, fieldsToUpdate) => {
  try {
    return await User.findOneAndUpdate(
      { telegramId },
      { $set: fieldsToUpdate },
      { new: true }
    );
  } catch (error) {
    console.error("Error updating user field:", error);
    return null;
  }
};

// Daily reset
async function resetDailyUsageIfNeeded(user) {
  const today = new Date().toDateString();
  const lastUsed = user.aiUsage?.lastUsedDate?.toDateString();

  if (today !== lastUsed) {
    user.aiUsage.dailyUses = 0;
    user.aiUsage.lastUsedDate = new Date();
    await user.save();
  }
}

// Weekly reset
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

// Week calculation helper
function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + firstDay.getDay() + 1) / 7);
}

// Check AI usage access based on subscription/trial
async function hasAIUsageAccess(user, type = 'general') {
  const now = new Date();
  const trialEnds = new Date(user.trialStartDate);
  trialEnds.setDate(trialEnds.getDate() + 14);

  const isTrialActive = now <= trialEnds;
  const isSubscribed = user.subscription && user.subscription.status === 'active';

  await resetDailyUsageIfNeeded(user);
  await resetWeeklyUsageIfNeeded(user);

  const usage = user.aiUsage || { dailyUses: 0, weeklyUses: 0 };

  if (user.subscription?.plan === 'premium' && isSubscribed) return true;

  if (isTrialActive && usage.dailyUses < 5) return true;

  if (user.subscription?.plan === 'basic' && isSubscribed) {
    if (type === 'checklist' && usage.weeklyUses < 10) return true;
    return false; // Basic plan cannot use general AI
  }

  return false;
}

// Increment usage counters
async function incrementAIUsage(user, type = 'general') {
  await resetDailyUsageIfNeeded(user);
  await resetWeeklyUsageIfNeeded(user);

  if (user.trialStartDate) {
    user.aiUsage.dailyUses += 1;
  } else if (user.subscription?.plan === 'basic' && type === 'checklist') {
    user.aiUsage.weeklyUses += 1;
  }

  user.aiUsage.lastUsedDate = new Date();
  await user.save();
}

// 🆕 New: Unified AI usage update function
async function updateUserAIUsage(user, type = 'general') {
  try {
    await incrementAIUsage(user, type);
  } catch (error) {
    console.error("❌ Error updating AI usage:", error);
  }
}

// Get the correct model (GPT-3.5 or GPT-4o)
async function getModelForUser(user) {
  return getCurrentModelForUser(user);
}

// --- CORRECTED addGoalMemory function to return a boolean ---
async function addGoalMemory(user, goalText) {
  if (user && goalText) {
    // Only save the goal if it's new or different from the current one
    if (!user.goalMemory || user.goalMemory.text !== goalText) {
      user.goalMemory = {
        text: goalText,
        date: new Date()
      };
      await user.save();
      console.log(`✅ Goal for user ${user.telegramId} saved to database.`);
      return true; // Return true if a new goal was saved
    }
  }
  return false; // Return false if no new goal was saved
}

// --- NEW MEMORY-RELATED FUNCTIONS ---
async function addRecentChat(user, message) {
  if (!user || !message) {
    console.error("❌ Invalid user or message for addRecentChat.");
    return;
  }
  
  const MAX_CHAT_HISTORY = 20;
  
  user.recentChatMemory.push({
    text: message,
    timestamp: new Date()
  });

  if (user.recentChatMemory.length > MAX_CHAT_HISTORY) {
    user.recentChatMemory = user.recentChatMemory.slice(-MAX_CHAT_HISTORY);
  }

  await user.save();
}

async function addImportantMemory(user, message) {
  if (!user || !message) {
    console.error("❌ Invalid user or message for addImportantMemory.");
    return;
  }

  user.importantMemory.push({
    text: message,
    timestamp: new Date()
  });

  await user.save();
}

// --- NEW FUNCTION TO UPDATE CHECKLIST STATUS ---
async function updateChecklistStatus(userId, date, checkedIn, progressReport) {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found.");

    const checklist = user.checklists.find(c => new Date(c.date).toDateString() === new Date(date).toDateString());
    if (!checklist) throw new Error("Checklist not found for this date.");

    checklist.checkedIn = checkedIn;
    checklist.progressReport = progressReport;
    await user.save();
    return checklist;
}
// --- END OF NEW FUNCTIONS ---

module.exports = {
  getOrCreateUser,
  getUserByTelegramId,
  updateUser,
  hasAIUsageAccess,
  incrementAIUsage,
  updateUserAIUsage,
  getModelForUser,
  updateUserField,
  addGoalMemory,
  addRecentChat,
  addImportantMemory,
  updateChecklistStatus // 🆕 Export the new function
};