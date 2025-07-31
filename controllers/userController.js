const User = require('../models/user');

// ─── User Retrieval ───────────────────────────────────────────────

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

// ─── Streak Management ─────────────────────────────────────────────

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

// ─── Task Management ──────────────────────────────────────────────

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

// ─── AI Usage Tracking ─────────────────────────────────────────────

async function incrementAIUsage(telegramId) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const usage = await getAIUsage(telegramId);
    const plan = await getUserSubscription(telegramId);

    if (plan.type === 'basic' && usage >= 10) return; // block after 10/week

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

// ─── Goal and Subscription ────────────────────────────────────────

async function getUserGoal(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    return user?.goal || null;
  } catch (error) {
    console.error('Error getting user goal:', error);
    return null;
  }
}

async function getUserSubscription(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) return { type: 'none', expired: true };

    const now = new Date();
    const trialExpired = user.createdAt && (now - user.createdAt) / (1000 * 60 * 60 * 24) > 14;

    if (user.subscription && user.subscription.status === 'active') {
      const expiry = new Date(user.subscription.expiryDate);
      const expired = expiry < now;
      return {
        type: user.subscription.plan,
        expired,
        expiryDate: expiry,
      };
    }

    return {
      type: trialExpired ? 'none' : 'trial',
      expired: trialExpired,
    };
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return { type: 'none', expired: true };
  }
}

async function canUseAI(telegramId) {
  const usage = await getAIUsage(telegramId);
  const sub = await getUserSubscription(telegramId);

  if (sub.type === 'premium' && !sub.expired) return true;
  if (sub.type === 'basic' && !sub.expired) return usage < 10;
  if (sub.type === 'trial' && !sub.expired) return usage < 5;

  return false;
}

async function getAvailableModel(telegramId) {
  const sub = await getUserSubscription(telegramId);
  if (sub.type === 'premium' && !sub.expired) return 'gpt-4o';
  return 'gpt-3.5-turbo';
}

// ─── Exports ──────────────────────────────────────────────────────

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
  getUserGoal,
  getUserSubscription,
  canUseAI,
  getAvailableModel,
};
