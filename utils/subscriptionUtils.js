// utils/checkAccess.js

const User = require('../models/user');

const checkAccess = async (userId) => {
  const user = await User.findOne({ telegramId: userId });

  if (!user) return false;

  // If they're on a trial
  if (user.subscriptionStatus === 'trial') {
    if (!user.trialStartDate) return false;

    const now = new Date();
    const trialEndsAt = new Date(user.trialStartDate);
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    return now <= trialEndsAt;
  }

  // If they're subscribed
  if (user.subscriptionStatus === 'subscribed') {
    if (!user.subscriptionExpiryDate) return false;

    return new Date() <= new Date(user.subscriptionExpiryDate);
  }

  return false;
};

module.exports = checkAccess;
