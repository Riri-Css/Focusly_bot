// File: src/utils/subscriptionUtils.js - UPDATED WITH REMINDER FUNCTIONALITY
const moment = require('moment-timezone');
const User = require('../models/user');
const OpenAI = require('openai');

const TIMEZONE = 'Africa/Lagos';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const PLAN_DETAILS = {
    'free-trial': {
        price: 0,
        aiUsageLimit: { general: 10, checklist: 1 },
        model: 'gpt-3.5-turbo',
        features: [
            'AI-powered daily tasks',
            'Basic streak tracking',
            'Limited AI access',
            '7-day trial period'
        ]
    },
    'free': {
        price: 0,
        aiUsageLimit: { general: 0, checklist: 0 },
        model: 'gpt-3.5-turbo',
        features: [
            'Manual task setting',
            'Basic reminders',
            'Goal tracking',
            'No AI assistance'
        ]
    },
    'basic': {
        price: 100000, // ₦1,000 in kobo
        aiUsageLimit: { general: 20, checklist: 35 },
        model: 'gpt-3.5-turbo',
        paystackPlanCode: 'PLN_i11fd0j98ycrcgd',
        features: [
            'AI-powered daily tasks',
            'Weekly progress reflections',
            'Basic streak tracking',
            '50 AI messages/month'
        ]
    },
    'premium': {
        price: 200000, // ₦2,000 in kobo
        aiUsageLimit: { general: 80, checklist: 35 },
        model: 'gpt-4o',
        paystackPlanCode: 'PLN_1yusx7cuhiuw0vc',
        features: [
            'Unlimited AI tasks & messages',
            'Advanced analytics & insights',
            'Monthly deep reflections',
            'Smart priority reminders',
            'Priority support'
        ]
    }
};

function getPlanDetails(planName) {
    return PLAN_DETAILS[planName] || PLAN_DETAILS.free;
}

// 🆕 Get all plan details for subscription reminders
function getAllPlanDetails() {
    return {
        free: PLAN_DETAILS.free,
        basic: PLAN_DETAILS.basic,
        premium: PLAN_DETAILS.premium
    };
}

// 🆕 TIER CHECK FUNCTIONS
function isFreeUser(user) {
    if (!user || !user.subscriptionPlan) return true;
    return user.subscriptionPlan === 'free' && user.subscriptionStatus === 'inactive';
}

function isBasicUser(user) {
    if (!user || !user.subscriptionPlan) return false;
    return user.subscriptionPlan === 'basic' && user.subscriptionStatus === 'active';
}

function isPremiumUser(user) {
    if (!user || !user.subscriptionPlan) return false;
    return user.subscriptionPlan === 'premium' && user.subscriptionStatus === 'active';
}

function hasTrialAccess(user) {
    if (!user || !user.subscriptionPlan) return false;
    return user.subscriptionPlan === 'free-trial' && user.subscriptionStatus === 'trialing';
}

function hasAIAccess(user) {
    return !isFreeUser(user);
}

function hasAutoTasks(user) {
    return !isFreeUser(user);
}

// 🛠️ FIXED: Streaks should work for Trial, Basic, and Premium users
function hasStreaks(user) {
    if (!user || !user.subscriptionPlan) return false;
    return user.subscriptionPlan !== 'free';
}

function hasReflections(user) {
    return !isFreeUser(user);
}

function hasSmartReminders(user) {
    return isPremiumUser(user);
}

function canAccessFeature(user, feature) {
    switch (feature) {
        case 'ai_access':
            return hasAIAccess(user);
        case 'auto_tasks':
            return hasAutoTasks(user);
        case 'streaks':
            return hasStreaks(user);
        case 'reflections':
            return hasReflections(user);
        case 'smart_reminders':
            return hasSmartReminders(user);
        default:
            return false;
    }
}

/**
 * Checks if a user has AI usage access based on their plan and limits.
 */
async function hasAIUsageAccess(user, type = 'general') {
    try {
        const refreshedUser = await User.findById(user._id);
        if (!refreshedUser) {
            return false;
        }

        if (isFreeUser(refreshedUser)) {
            return false;
        }

        if (refreshedUser.subscriptionPlan === 'free-trial') {
            const now = moment().tz(TIMEZONE);
            const subscriptionEnd = moment(refreshedUser.subscriptionEndDate).tz(TIMEZONE);
            
            const bufferHours = 2;
            const subscriptionEndWithBuffer = subscriptionEnd.clone().add(bufferHours, 'hours');
            
            if (now.isAfter(subscriptionEndWithBuffer)) {
                refreshedUser.subscriptionStatus = 'inactive';
                refreshedUser.subscriptionPlan = 'free';
                await refreshedUser.save();
                console.log(`Trial expired for user ${refreshedUser.telegramId}`);
                return false;
            }
        }

        if (!refreshedUser.aiUsage || !Array.isArray(refreshedUser.aiUsage)) {
            refreshedUser.aiUsage = [];
            await refreshedUser.save();
        }

        if (refreshedUser.subscriptionPlan === 'premium') {
            return true;
        }

        const planLimits = getPlanDetails(refreshedUser.subscriptionPlan).aiUsageLimit;
        if (!planLimits) {
            return false;
        }
        
        const today = moment().tz(TIMEZONE).startOf('day').toDate();

        let usage = refreshedUser.aiUsage.find(u => 
            u.date && moment(u.date).tz(TIMEZONE).isSame(today, 'day')
        );
        
        if (!usage) {
            return true;
        }

        if (type === 'general') {
            return usage.generalCount < planLimits.general;
        } else if (type === 'checklist') {
            return usage.checklistCount < planLimits.checklist;
        }

        return false;
    } catch (error) {
        console.error('Error in hasAIUsageAccess:', error);
        return true;
    }
}

/**
 * Tracks AI usage for a user.
 */
async function trackAIUsage(user, type) {
    try {
        const refreshedUser = await User.findById(user._id);
        if (!refreshedUser) {
            console.error('User not found for AI usage tracking');
            return;
        }
        
        if (isFreeUser(refreshedUser)) {
            return;
        }
        
        if (!refreshedUser.aiUsage || !Array.isArray(refreshedUser.aiUsage)) {
            refreshedUser.aiUsage = [];
        }
        
        if (refreshedUser.subscriptionPlan === 'premium') {
            return;
        }
        
        const today = moment().tz(TIMEZONE).startOf('day').toDate();

        let usage = refreshedUser.aiUsage.find(u => 
            u.date && moment(u.date).tz(TIMEZONE).isSame(today, 'day')
        );
        
        if (!usage) {
            usage = { date: today, generalCount: 0, checklistCount: 0 };
            refreshedUser.aiUsage.unshift(usage);
            if (refreshedUser.aiUsage.length > 30) {
                refreshedUser.aiUsage.pop();
            }
        }

        if (type === 'general') {
            usage.generalCount++;
        } else if (type === 'checklist') {
            usage.checklistCount++;
        }

        await refreshedUser.save();
    } catch (error) {
        console.error('Error tracking AI usage:', error);
    }
}

/**
 * Determines the appropriate OpenAI model for a user.
 */
function getModelForUser(user) {
    const plan = user.subscriptionPlan || 'free';
    return getPlanDetails(plan).model;
}

// 🆕 NEW FUNCTION: Check if user should get streak tracking
function shouldGetStreakTracking(user) {
    if (!user || !user.subscriptionPlan) return false;
    return user.subscriptionPlan !== 'free';
}

// 🆕 NEW FUNCTION: Check if should send subscription reminder (every 4 days)
function shouldSendSubscriptionReminder(user) {
    if (!isFreeUser(user)) return false;
    
    if (!user.lastSubscriptionReminder) return true;
    
    const lastReminder = moment(user.lastSubscriptionReminder);
    const daysSinceLastReminder = moment().diff(lastReminder, 'days');
    
    return daysSinceLastReminder >= 4;
}

// 🆕 NEW FUNCTION: Get feature comparison for messaging
function getFeatureComparison() {
    const plans = getAllPlanDetails();
    return {
        free: plans.free.features,
        basic: plans.basic.features,
        premium: plans.premium.features
    };
}

// 🆕 NEW FUNCTION: Get upgrade benefits message
function getUpgradeBenefits(currentPlan) {
    const features = getFeatureComparison();
    
    if (isFreeUser({ subscriptionPlan: currentPlan })) {
        return {
            basic: features.basic.filter(feat => !features.free.includes(feat)),
            premium: features.premium.filter(feat => !features.free.includes(feat))
        };
    }
    
    if (currentPlan === 'basic') {
        return {
            premium: features.premium.filter(feat => !features.basic.includes(feat))
        };
    }
    
    return {};
}

module.exports = {
    getPlanDetails,
    getAllPlanDetails,
    hasAIUsageAccess,
    trackAIUsage,
    getModelForUser,
    isFreeUser,
    isBasicUser,
    isPremiumUser,
    hasTrialAccess,
    hasAIAccess,
    hasAutoTasks,
    hasStreaks,
    hasReflections,
    hasSmartReminders,
    canAccessFeature,
    shouldGetStreakTracking,
    shouldSendSubscriptionReminder,
    getFeatureComparison,
    getUpgradeBenefits,
    PLAN_DETAILS
};