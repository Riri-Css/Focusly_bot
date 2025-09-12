// File: src/utils/telegram.js - UPDATED WITH SUBSCRIPTION REMINDER
const moment = require('moment-timezone');
const { getPlanDetails, isFreeUser, isBasicUser, isPremiumUser } = require('./subscriptionUtils');

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
            text: "🎯 You're already Premium!",
            callback_data: JSON.stringify({ action: 'already_premium' })
        }]];
    } else {
        return [
            [{
                text: `💎 Premium - ₦${premiumPlan.price / 100}/month`,
                callback_data: JSON.stringify({ action: 'subscribe', plan: 'premium' })
            }],
            [{
                text: `✨ Basic - ₦${basicPlan.price / 100}/month`,
                callback_data: JSON.stringify({ action: 'subscribe', plan: 'basic' })
            }],
            [{
                text: "❌ Maybe Later",
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
    const basicPlan = getPlanDetails('basic');
    const premiumPlan = getPlanDetails('premium');
    
    const message = `💎 *Upgrade Your Productivity Game* 🚀\n\n` +
        `✨ *Basic Plan - ₦${basicPlan.price / 100}/month*\n` +
        `✅ AI-powered daily tasks\n` +
        `✅ Weekly progress reflections\n` +
        `✅ Basic streak tracking\n` +
        `✅ 50 AI messages/month\n\n` +
        `💎 *Premium Plan - ₦${premiumPlan.price / 100}/month*\n` +
        `✅ Unlimited AI tasks & messages\n` +
        `✅ Advanced analytics & insights\n` +
        `✅ Monthly deep reflections\n` +
        `✅ Smart priority reminders\n` +
        `✅ Priority support\n\n` +
        `🎯 *Your current plan:* ${isPremium ? 'Premium 🎯' : 'Basic ⭐'}\n\n` +
        `*Choose your upgrade path below:*`;

    const options = {
        reply_markup: {
            inline_keyboard: getSubscriptionOptions(isPremium)
        },
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };
    
    await sendTelegramMessage(bot, chatId, message, options);
}

/**
 * Sends subscription reminder to free users
 * @param {object} bot - The Telegram bot instance
 * @param {number} chatId - The ID of the chat
 * @param {object} user - The user object
 */
async function sendSubscriptionReminder(bot, chatId, user) {
    if (!isFreeUser(user)) return;
    
    const basicPlan = getPlanDetails('basic');
    const premiumPlan = getPlanDetails('premium');
    
    const message = `🎯 *Time to Level Up Your Productivity!* 🚀\n\n` +
        `You've been using Focusly Free. Ready to unlock your full potential?\n\n` +
        `✨ *Basic Plan - ₦${basicPlan.price / 100}/month*\n` +
        `• AI-powered daily tasks\n` +
        `• Weekly progress reflections\n` +
        `• Basic streak tracking\n` +
        `• 50 AI messages/month\n\n` +
        `💎 *Premium Plan - ₦${premiumPlan.price / 100}/month*\n` +
        `• Unlimited AI tasks & messages\n` +
        `• Advanced analytics\n` +
        `• Monthly deep reflections\n` +
        `• Smart reminders\n` +
        `• Priority support\n\n` +
        `🔗 *Payment Links:*\n` +
        `Basic: https://yourpaymentlink.com/basic\n` +
        `Premium: https://yourpaymentlink.com/premium\n\n` +
        `💪 *Your current goal:* ${user.goalMemory?.text || "Not set yet"}\n\n` +
        `*Imagine what you could achieve with the right tools!*`;

    const options = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
            inline_keyboard: [
                [{
                    text: "💎 Upgrade to Premium",
                    callback_data: JSON.stringify({ action: 'subscribe', plan: 'premium' })
                }],
                [{
                    text: "✨ Upgrade to Basic", 
                    callback_data: JSON.stringify({ action: 'subscribe', plan: 'basic' })
                }],
                [{
                    text: "❌ Not Now",
                    callback_data: JSON.stringify({ action: 'dismiss_reminder' })
                }]
            ]
        }
    };

    await bot.sendMessage(chatId, message, options);
}

/**
 * Sends a well-formatted message with proper spacing and emojis
 * @param {object} bot - The Telegram bot instance
 * @param {number} chatId - The ID of the chat  
 * @param {string} messageText - The message text
 * @param {object} options - Additional options
 */
async function sendFormattedMessage(bot, chatId, messageText, options = {}) {
    const defaultOptions = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };
    
    await bot.sendMessage(chatId, messageText, { ...defaultOptions, ...options });
}

module.exports = {
    getSubscriptionOptions,
    sendSubscriptionOptions,
    sendSubscriptionReminder,
    sendFormattedMessage
};