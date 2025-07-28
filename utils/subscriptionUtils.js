const User = require("../models/user");

const checkAccess = async (telegramId) => {
  const user = await User.findOne({ telegramId });
  const now = new Date();

  if (!user) return false;

  // Check if still within 14-day trial
  const trialStart = user.trialStartedAt || user.createdAt;
  const trialEnd = new Date(trialStart);
  trialEnd.setDate(trialEnd.getDate() + 14);
  const isTrialValid = now <= trialEnd;

  // Check if there's a valid subscription
  const isSubscribed =
    user.isSubscribed &&
    user.subscription?.expiresAt &&
    now <= new Date(user.subscription.expiresAt);

  return isTrialValid || isSubscribed;
};

module.exports = { checkAccess };
