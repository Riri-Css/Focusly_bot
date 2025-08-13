// File: src/utils/telegram.js - FINAL CORRECTED VERSION
const moment = require('moment-timezone');
const { getPlanDetails } = require('./subscriptionUtils');

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
                text: `✨ Premium (₦${premiumPlan.price / 100}/month)`,
                callback_data: JSON.stringify({ action: 'subscribe', plan: 'premium' })
            }],
            [{
                text: `💰 Basic (₦${basicPlan.price / 100}/month)`,
                callback_data: JSON.stringify({ action: 'subscribe', plan: 'basic' })
            }],
            [{
                text: "⬅️ Cancel",
                callback_data: JSON.stringify({ action: 'cancel' })
            }]
        ];
    }
}

/**
 * Sends the subscription options message to the user.
 * @param {object} bot - The Telegram bot instance.
 * @param {number} chatId - The ID of the chat.
 * @param {boolean} isPremium - True if the user is already premium.
 * @param {function} sendTelegramMessage - The function to send a message.
 */
async function sendSubscriptionOptions(bot, chatId, isPremium, sendTelegramMessage) {
    const options = {
        reply_markup: {
            inline_keyboard: getSubscriptionOptions(isPremium)
        },
        parse_mode: 'Markdown'
    };
    await sendTelegramMessage(bot, chatId, "Choose a plan to upgrade your GoalBot experience:", options);
}

module.exports = {
    getSubscriptionOptions,
    sendSubscriptionOptions
};