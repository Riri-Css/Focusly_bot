// File: src/utils/adminUtils.js - UPDATED

const moment = require('moment');
const User = require('../models/user');

/**
 * Manually updates a user's subscription status and plan.
 * @param {string} telegramId - The user's Telegram ID.
 * @param {string} plan - The new subscription plan ('premium', 'basic', etc.).
 * @returns {Promise<object|null>} The updated user object, or null if not found.
 */
async function updateSubscription(telegramId, plan) {
    let subscriptionEndDate;

    // Define subscription end dates based on the plan
    if (plan === 'premium' || plan === 'pro') {
        subscriptionEndDate = moment().add(1, 'month').toDate();
    } else if (plan === 'basic') {
        subscriptionEndDate = moment().add(1, 'year').toDate();
    } else {
        // If plan is 'free' or invalid, set to 30 days trial
        subscriptionEndDate = moment().add(30, 'days').toDate();
    }

    // Return the updated user object
    return User.findOneAndUpdate(
        { telegramId: telegramId },
        {
            subscriptionStatus: 'active',
            subscriptionPlan: plan,
            subscriptionEndDate: subscriptionEndDate,
            isSubscriptionExpired: false,
        },
        { new: true, useFindAndModify: false }
    );
}

module.exports = {
    updateSubscription,
};