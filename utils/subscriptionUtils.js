// utils/subscriptionUtils.js

const User = require('../models/User');

const checkAccess = async (telegramId) => {
  const user = await User.findOne({ telegramId });

  if (!user) return false;

  const now = new Date();

  if (user.subscriptionStatus === 'subscribed' && user.subscriptionExpiryDate > now) {
    return true;
  }

  // If user is on trial and still within 14 days
  if (user.subscriptionStatus === 'trial') {
    const trialStart = user.trialStartDate;
    const daysSinceTrialStart = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
    if (daysSinceTrialStart <= 14) return true;
  }

  return false;
};

module.exports = { checkAccess };
