const { User } = require('../models/user');

// ✅ Determine AI model and access
async function getAIModelAndAccess(user) {
  const today = new Date().toISOString().split('T')[0];

  if (user.subscriptionStatus === 'trial') {
    if (user.lastUsageDate !== today) {
      user.usageCount = 0;
      user.lastUsageDate = today;
      await user.save();
    }

    if (user.usageCount < 5) {
      return { allowed: true, model: 'gpt-4o' };
    } else {
      return { allowed: false, reason: 'Trial limit reached for today. Upgrade for unlimited access.' };
    }
  }

  if (user.subscriptionStatus === 'subscribed') {
    if (user.subscriptionPlan === 'premium') {
      return { allowed: true, model: 'gpt-4o' };
    }

    if (user.subscriptionPlan === 'basic') {
      const startOfWeek = getStartOfWeek();
      if (!user.lastUsageDate || new Date(user.lastUsageDate) < startOfWeek) {
        user.usageCount = 0;
        user.lastUsageDate = today;
        await user.save();
      }

      if (user.usageCount < 10) {
        return { allowed: true, model: 'gpt-3.5-turbo' };
      } else {
        return { allowed: false, reason: 'Weekly usage limit reached. Upgrade for unlimited access.' };
      }
    }
  }

  return { allowed: false, reason: 'Access expired. Please subscribe to continue using AI.' };
}

// ✅ Optional helper if needed elsewhere
async function hasAccessToAI(user, isChecklist = false) {
  const result = await getAIModelAndAccess(user);
  if (!result.allowed) return false;
  if (user.subscriptionPlan === 'basic' && !isChecklist) return false;
  return true;
}

// ✅ Increment usage
async function incrementUsage(telegramId) {
  const user = await User.findOne({ telegramId });
  if (!user) return;

  user.usageCount = (user.usageCount || 0) + 1;
  user.lastUsageDate = new Date().toISOString().split('T')[0];
  await user.save();
}

// ✅ Used for access tier messages
function checkAccessLevel(user) {
  if (user.subscriptionStatus === 'trial') return 'trial';
  if (user.subscriptionStatus === 'subscribed') return user.subscriptionPlan || 'basic';
  return 'none';
}

// 🗓 Helper: Week starts on Monday
function getStartOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff));
}

module.exports = {
  getAIModelAndAccess,
  hasAccessToAI,
  incrementUsage,
  checkAccessLevel,
};
