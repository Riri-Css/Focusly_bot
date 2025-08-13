// File: src/utils/telegram.js - CORRECTED VERSION
const moment = require('moment-timezone');

/**
 * Creates the inline keyboard for subscription options with JSON callback data.
 * @param {boolean} isPremium - True if the user is already premium.
 * @returns {Array<Array<object>>} The inline keyboard.
 */
function getSubscriptionOptions(isPremium) {
    if (isPremium) {
        return [[{
            text: "You are already a premium subscriber! ✅",
            callback_data: JSON.stringify({ action: 'already_premium' })
        }]];
    } else {
        return [
            [{
                text: "✨ Premium (₦1,500/month)", // <-- CORRECTED PRICE
                callback_data: JSON.stringify({ action: 'subscribe', plan: 'premium' })
            }],
            [{
                text: "💰 Basic (₦1,000/month)", // <-- CORRECTED PRICE
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
 * Sends a message with subscription options.
 * @param {object} bot - The Telegram bot instance.
 * @param {number} chatId - The chat ID.
 * @param {boolean} isPremium - True if the user is already premium.
 */
async function sendSubscriptionOptions(bot, chatId, isPremium) {
    try {
        await bot.sendMessage(chatId, "Choose a subscription plan:", {
            reply_markup: {
                inline_keyboard: getSubscriptionOptions(isPremium)
            }
        });
    } catch (error) {
        console.error("❌ Error sending subscription options:", error);
    }
}

module.exports = {
    sendSubscriptionOptions
};