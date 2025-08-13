// File: src/utils/subscriptionUtils.js
const moment = require('moment');

// --- NEW CODE: Centralized plan details ---
function getPlanDetails(plan) {
    const plans = {
        'basic': {
            name: 'Basic',
            price: 1000,   // price in Naira
            priceInKobo: 1000 * 100 // price for Paystack
        },
        'premium': {
            name: 'Premium',
            price: 1500,   // price in Naira
            priceInKobo: 1500 * 100 // price for Paystack
        }
    };
    return plans[plan] || null;
}
// --- END NEW CODE ---

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

  if (user.lastUsageUpdate) {
    const lastUpdateMoment = moment(user.lastUsageUpdate);
    
    if (!moment().isSame(lastUpdateMoment, 'day')) {
      user.dailyAIUses = 0;
    }
    
    if (!moment().isSame(lastUpdateMoment, 'week')) {
      user.weeklyAIUses = 0;
    }
  }

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
  user.lastUsageUpdate = new Date();

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

module.exports = {
  hasAIUsageAccess: canAccessAI,
  trackAIUsage: incrementAIUsage,
  getModelForUser: getAIModel,
  recordAIUsage: incrementAIUsage,
  isTrialExpired,
  hasActiveSubscription,
  getUserPlan,
  checkAIEligibility: canAccessAI,
  getUserPlan,
  getPlanDetails // <-- NEW: Export the centralized function
};