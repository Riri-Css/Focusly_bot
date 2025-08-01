// utils/subscriptionUtils.js

const moment = require('moment');

function isTrialExpired(user) {
  if (!user.trialStartDate) return true;
  const daysSinceTrial = moment().diff(moment(user.trialStartDate), 'days');
  return daysSinceTrial > 13;
}

function hasActiveSubscription(user) {
  if (!user.subscription || !user.subscription.status) return false;
  return user.subscription.status === 'active' &&
    (!user.subscription.expiresAt || moment().isBefore(user.subscription.expiresAt));
}

function getUserPlan(user) {
  if (hasActiveSubscription(user)) {
    return user.subscription.plan; // 'basic' or 'premium'
  }
  return isTrialExpired(user) ? 'none' : 'trial';
}

function canAccessAI(user, feature = 'general') {
  const plan = getUserPlan(user);
  if (plan === 'premium') return true;
  if (plan === 'basic') {
    if (feature === 'checklist') return (user.weeklyAIUses || 0) < 10;
    return false;
  }
  if (plan === 'trial') {
    return (user.dailyAIUses || 0) < 5;
  }
  return false;
}

function incrementAIUsage(user, feature = 'general') {
  const plan = getUserPlan(user);
  if (plan === 'basic' && feature === 'checklist') {
    user.weeklyAIUses = (user.weeklyAIUses || 0) + 1;
  } else if (plan === 'trial') {
    user.dailyAIUses = (user.dailyAIUses || 0) + 1;
  }
  return user.save();
}

function getAIModel(user) {
  const plan = getUserPlan(user);
  if (plan === 'premium') return 'gpt-4o';
  if (plan === 'basic') return 'gpt-3.5-turbo';
  if (plan === 'trial') return 'gpt-4o';
  return null;
}

// Aliased exports for messageHandlers.js compatibility
module.exports = {
  hasAIUsageAccess: canAccessAI,
  trackAIUsage: incrementAIUsage,
  getModelForUser: getAIModel,
  recordAIUsage: incrementAIUsage, // alias for flexibility
  isTrialExpired,
  hasActiveSubscription,
  getUserPlan,
  checkAIEligibility: canAccessAI,
  getUserPlan,
};
