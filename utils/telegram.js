// File: src/utils/telegram.js - CORRECTED VERSION
const moment = require('moment-timezone');
const { getPlanDetails } = require('./subscriptionUtils'); // <-- NEW: Import the utility

/**
 * Creates the inline keyboard for subscription options with JSON callback data.
 * @param {boolean} isPremium - True if the user is already premium.
 * @returns {Array<Array<object>>} The inline keyboard.
 */
function getSubscriptionOptions(isPremium) {
    const basicPlan = getPlanDetails('basic');
    const premiumPlan = getPlanDetails('premium');

    if (isPremium) {
        return [[{
            text: "You are already a premium subscriber! ✅",
            callback_data: JSON.stringify({ action: 'already_premium' })
        }]];
    } else {
        return [
            [{
                text: `✨ Premium (₦${premiumPlan.price}/month)`,
                callback_data: JSON.stringify({ action: 'subscribe', plan: 'premium' })
            }],
            [{
                text: `💰 Basic (₦${basicPlan.price}/month)`,
                callback_data: JSON.stringify({ action: 'subscribe', plan: 'basic' })
            }],
            [{
                text: "⬅️ Cancel",
                callback_data: JSON.stringify({ action: 'cancel' })
            }]
        ];
    }
}
// ... (rest of the file remains the same)