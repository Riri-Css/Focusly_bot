// File: src/utils/subscriptionUtils.js - FINAL CORRECTED VERSION

const moment = require('moment-timezone');
const User = require('../models/user');
// New way to import and initialize OpenAI
const OpenAI = require('openai');

const TIMEZONE = 'Africa/Lagos';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const PLAN_DETAILS = {
    'free': {
        price: 0,
        aiUsageLimit: { general: 3, checklist: 1 },
        model: 'gpt-3.5-turbo'
    },
    'basic': {
        price: 100000, // ₦1,000 in kobo
        aiUsageLimit: { general: 30, checklist: 30 },
        model: 'gpt-3.5-turbo'
    },
    'premium': {
        price: 150000, // ₦1,500 in kobo
        aiUsageLimit: null, // Unlimited
        model: 'gpt-4'
    }
};

/**
 * Retrieves the details for a given plan.
 * @param {string} planName - The name of the plan ('free', 'basic', 'premium').
 * @returns {object} The plan details.
 */
function getPlanDetails(planName) {
    return PLAN_DETAILS[planName] || PLAN_DETAILS.free;
}

/**
 * Checks if a user has AI usage access based on their plan and limits.
 * @param {object} user - The user object.
 * @param {string} type - The type of usage ('general' or 'checklist').
 * @returns {Promise<boolean>} True if the user has access, false otherwise.
 */
async function hasAIUsageAccess(user, type = 'general') {
    if (user.subscriptionPlan === 'premium') {
        return true; // Premium users have unlimited access
    }

    const planLimits = getPlanDetails(user.subscriptionPlan).aiUsageLimit;
    if (!planLimits) {
        return false;
    }
    const today = moment().tz(TIMEZONE).startOf('day').toDate();

    let usage = user.aiUsage.find(u => moment(u.date).isSame(today, 'day'));
    if (!usage) {
        usage = { date: today, generalCount: 0, checklistCount: 0 };
        user.aiUsage.push(usage);
    }

    if (type === 'general') {
        return usage.generalCount < planLimits.general;
    } else if (type === 'checklist') {
        return usage.checklistCount < planLimits.checklist;
    }

    return false;
}

/**
 * Tracks AI usage for a user.
 * @param {object} user - The user object.
 * @param {string} type - The type of usage ('general' or 'checklist').
 */
async function trackAIUsage(user, type) {
    if (user.subscriptionPlan === 'premium') {
        return; // Premium users don't have usage tracked
    }
    
    const today = moment().tz(TIMEZONE).startOf('day').toDate();

    let usage = user.aiUsage.find(u => moment(u.date).isSame(today, 'day'));
    if (!usage) {
        usage = { date: today, generalCount: 0, checklistCount: 0 };
        user.aiUsage.push(usage);
    }

    if (type === 'general') {
        usage.generalCount++;
    } else if (type === 'checklist') {
        usage.checklistCount++;
    }

    await user.save();
}

/**
 * Determines the appropriate OpenAI model for a user based on their subscription.
 * @param {object} user - The user object.
 * @returns {string} The model name.
 */
function getModelForUser(user) {
    return getPlanDetails(user.subscriptionPlan).model;
}


module.exports = {
    getPlanDetails,
    hasAIUsageAccess,
    trackAIUsage,
    getModelForUser,
};