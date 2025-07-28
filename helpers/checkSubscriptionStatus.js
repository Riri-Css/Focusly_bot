const User = require('../models/user');

// Returns true if user has access (trial not expired or active subscription)
async function checkAccess(userId) {
  const user = await User.findOne({ telegramId: userId.toString() });
  if (!user) return false;

  const now = new Date();

  // 1. Check active paid subscription
  if (
    user.subscriptionStatus === 'active' &&
    user.subscriptionExpiryDate &&
    user.subscriptionExpiryDate > now
  ) {
    return true;
  }

  // 2. Check free trial
  if (user.trialStartDate) {
    const trialEnds = new Date(user.trialStartDate);
    trialEnds.setDate(trialEnds.getDate() + 14);

    if (now < trialEnds) {
      return true; // Trial is still active
    }
  }

  return false; // No active access
}

module.exports = checkAccess;
