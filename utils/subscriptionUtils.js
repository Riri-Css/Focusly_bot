const { User } = require('../models/user');

// Check if user has AI access and return their model
async function getAIModelAndAccess(user) {
  const today = new Date().toISOString().split('T')[0];

  // Handle trial
  if (user.subscriptionStatus === 'trial') {
    // Reset daily usage if date changed
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

  // Handle subscribed users
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

  // Handle expired
  return { allowed: false, reason: 'Access expired. Please subscribe to continue using AI.' };
}

function getStartOfWeek() {
  const now = new Date();
  const day = now.getDay(); // Sunday is 0, Monday is 1...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  return new Date(now.setDate(diff));
}

module.exports = { getAIModelAndAccess };
