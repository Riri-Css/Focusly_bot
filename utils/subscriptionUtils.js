const User = require('../models/user');

async function checkAccess(userId) {
  const user = await User.findOne({ telegramId: userId.toString() });
  if (!user) return false;

  const now = new Date();

  // First-time setup of trial
  if (!user.trialStarted) {
    user.trialStarted = now;
    user.trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14-day trial
    await user.save();
    return true;
  }

  // Grant access if subscribed
  if (user.isSubscribed && user.subscriptionEnds && user.subscriptionEnds > now) {
    return true;
  }

  // Grant access if trial is still active
  if (user.trialEnds && user.trialEnds > now) {
    return true;
  }

  // Otherwise, deny access
  return false;
}

module.exports = { checkAccess };
