const User = require('../models/user');

// Limit configuration
const DAILY_TRIAL_LIMIT = 5;
const WEEKLY_BASIC_LIMIT = 10;

// Check if user has AI access
async function checkAccess(telegramId) {
  const user = await User.findOne({ telegramId });
  if (!user) return false;

  const now = new Date();

  // Expiry check
  if (user.subscriptionStatus === 'expired') return false;

  // Trial check
  if (user.subscriptionStatus === 'trial') {
    const trialEnds = new Date(user.trialStartDate);
    trialEnds.setDate(trialEnds.getDate() + 14);

    if (now > trialEnds) {
      user.subscriptionStatus = 'expired';
      await user.save();
      return false;
    }

    if (!user.usageDate || new Date(user.usageDate).toISOString().split('T')[0] !== now.toISOString().split('T')[0]) {
      user.usageCount = 0;
      user.usageDate = now;
    }

    return user.usageCount < DAILY_TRIAL_LIMIT;
  }

  // Subscribed user
  if (user.subscriptionStatus === 'subscribed') {
    if (user.subscriptionExpiryDate && now > new Date(user.subscriptionExpiryDate)) {
      user.subscriptionStatus = 'expired';
      await user.save();
      return false;
    }

    if (user.subscriptionPlan === 'premium') {
      return true; // unlimited
    }

    if (user.subscriptionPlan === 'basic') {
      const usageDate = new Date(user.usageDate || 0);
      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(now.getDate() - now.getDay()); // start of current week

      if (usageDate < weekStart) {
        user.usageCount = 0;
        user.usageDate = now;
      }

      return user.usageCount < WEEKLY_BASIC_LIMIT;
    }
  }

  return false;
}

module.exports = {
  checkAccess
};
