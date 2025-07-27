// helpers/checkSubscriptionStatus.js
const User = require('../models/user');

module.exports = async function checkSubscriptionStatus(user) {
  if (!user) return false;

  const now = new Date();
  const createdAt = new Date(user.createdAt);
  const trialEndsAt = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days trial

  const trialActive = now < trialEndsAt;
  const subscribed = user.subscriptionStatus === 'active' && user.subscriptionEndDate && now < new Date(user.subscriptionEndDate);

  return trialActive || subscribed;
}
// This function checks if the user is still within their free trial or has an active subscription.