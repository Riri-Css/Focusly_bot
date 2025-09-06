// File: src/utils/subscriptionUtils.js - UPDATED WITH TIER DIFFERENTIATION
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
        model: 'gpt-3.5-turbo'
    },
    'free': {
        price: 0,
        aiUsageLimit: { general: 0, checklist: 0 }, // Free users get NO AI access
        model: 'gpt-3.5-turbo'
    },
    'basic': {
        price: 100000, // ₦1,000 in kobo
        aiUsageLimit: { general: 20, checklist: 35 },
        model: 'gpt-3.5-turbo',
        paystackPlanCode: 'PLN_i11fd0j98ycrcgd'
    },
    'premium': {
        price: 200000, // ₦2,000 in kobo
        aiUsageLimit: { general: 80, checklist: 35 },
        model: 'gpt-4o',
        paystackPlanCode: 'PLN_1yusx7cuhiuw0vc'
    }
};

function getPlanDetails(planName) {
    return PLAN_DETAILS[planName] || PLAN_DETAILS.free;
}

// 🆕 TIER CHECK FUNCTIONS
function isFreeUser(user) {
    return user.subscriptionPlan === 'free' && user.subscriptionStatus === 'inactive';
}

function isBasicUser(user) {
    return user.subscriptionPlan === 'basic' && user.subscriptionStatus === 'active';
}

function isPremiumUser(user) {
    return user.subscriptionPlan === 'premium' && user.subscriptionStatus === 'active';
}

function hasTrialAccess(user) {
    return user.subscriptionPlan === 'free-trial' && user.subscriptionStatus === 'trialing';
}

function hasAIAccess(user) {
    return !isFreeUser(user); // Only free users have NO AI access
}

function hasAutoTasks(user) {
    return !isFreeUser(user); // Free users manually set tasks
}

function hasStreaks(user) {
    return !isFreeUser(user); // Free users no streaks
}

function hasReflections(user) {
    return !isFreeUser(user); // Free users no reflections
}

function hasSmartReminders(user) {
    return isPremiumUser(user); // Premium-only feature
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
 * @param {object} user - The user object.
 * @param {string} type - The type of usage ('general' or 'checklist').
 * @returns {Promise<boolean>} True if the user has access, false otherwise.
 */
async function hasAIUsageAccess(user, type = 'general') {
    try {
        // ⭐ CRITICAL FIX: Refresh user to avoid version conflicts ⭐
        const refreshedUser = await User.findById(user._id);
        if (!refreshedUser) {
            return false;
        }

        // 🆕 FREE USERS GET NO AI ACCESS
        if (isFreeUser(refreshedUser)) {
            return false;
        }

        // ⭐ Trial expiration check with fresh user data ⭐
        if (refreshedUser.subscriptionPlan === 'free-trial') {
            const now = moment().tz(TIMEZONE);
            const subscriptionEnd = moment(refreshedUser.subscriptionEndDate).tz(TIMEZONE);
            
            // 🆕 Add buffer to prevent timezone edge cases
            const bufferHours = 2;
            const subscriptionEndWithBuffer = subscriptionEnd.clone().add(bufferHours, 'hours');
            
            if (now.isAfter(subscriptionEndWithBuffer)) {
                // Trial has expired, update to free plan
                refreshedUser.subscriptionStatus = 'inactive';
                refreshedUser.subscriptionPlan = 'free';
                await refreshedUser.save();
                console.log(`Trial expired for user ${refreshedUser.telegramId}`);
                return false;
            }
        }

        // Safety check for aiUsage array
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
            return true; // No usage today, so access is granted
        }

        if (type === 'general') {
            return usage.generalCount < planLimits.general;
        } else if (type === 'checklist') {
            return usage.checklistCount < planLimits.checklist;
        }

        return false;
    } catch (error) {
        console.error('Error in hasAIUsageAccess:', error);
        // Graceful degradation: allow access on error to avoid breaking user experience
        return true;
    }
}

/**
 * Tracks AI usage for a user.
 * @param {object} user - The user object.
 * @param {string} type - The type of usage ('general' or 'checklist').
 */
async function trackAIUsage(user, type) {
    try {
        // ⭐ CRITICAL FIX: Refresh user to avoid version conflicts ⭐
        const refreshedUser = await User.findById(user._id);
        if (!refreshedUser) {
            console.error('User not found for AI usage tracking');
            return;
        }
        
        // 🆕 FREE USERS DON'T TRACK AI USAGE (NO ACCESS)
        if (isFreeUser(refreshedUser)) {
            return;
        }
        
        // Safety check for aiUsage array
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
            // Keep only last 30 days of usage data
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
        // Don't throw error - silent fail to avoid breaking user experience
    }
}

/**
 * Determines the appropriate OpenAI model for a user based on their subscription.
 * @param {object} user - The user object.
 * @returns {string} The model name.
 */
function getModelForUser(user) {
    // Handle both direct user objects and refreshed user objects
    const plan = user.subscriptionPlan || 'free';
    return getPlanDetails(plan).model;
}

module.exports = {
    getPlanDetails,
    hasAIUsageAccess,
    trackAIUsage,
    getModelForUser,
    // 🆕 Export tier checking functions
    isFreeUser,
    isBasicUser,
    isPremiumUser,
    hasTrialAccess,
    hasAIAccess,
    hasAutoTasks,
    hasStreaks,
    hasReflections,
    hasSmartReminders,
    canAccessFeature
};