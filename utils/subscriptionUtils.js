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

  // 🆕 NEW: Reset usage if the day/week has changed
  if (user.lastUsageUpdate) {
    const lastUpdateMoment = moment(user.lastUsageUpdate);
    
    // Reset daily count if it's a new day
    if (!moment().isSame(lastUpdateMoment, 'day')) {
      user.dailyAIUses = 0;
    }
    
    // Reset weekly count if it's a new week
    if (!moment().isSame(lastUpdateMoment, 'week')) {
      user.weeklyAIUses = 0;
    }
  }

  if (plan === 'basic') {
    if (feature === 'checklist') return (user.weeklyAIUses || 0) < 10;
    return false; // Basic plan does not allow general AI chat
  }
  
  if (plan === 'trial') {
    return (user.dailyAIUses || 0) < 5;
  }
  
  return false;
}

function incrementAIUsage(user, feature = 'general') {
  const plan = getUserPlan(user);
  
  // 🆕 NEW: Update the timestamp before checking
  user.lastUsageUpdate = new Date();

  if (plan === 'basic' && feature === 'checklist') {
    user.weeklyAIUses = (user.weeklyAIUses || 0) + 1;
  } else if (plan === 'trial') {
    user.dailyAIUses = (user.dailyAIUses || 0) + 1;
  }
  // No increment for premium or other plans since they are unlimited

  // 🆕 The user.save() is already here, which is correct
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