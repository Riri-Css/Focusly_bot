// File: src/utils/adminUtils.js - COMPLETE FIX
const moment = require('moment');
const User = require('../models/user');
const { sendTelegramMessage } = require('../handlers/messageHandlers');

/**
 * Manually updates a user's subscription status and plan.
 * @param {string} telegramId - The user's Telegram ID.
 * @param {string} plan - The new subscription plan ('premium', 'basic', etc.).
 * @param {string} adminTelegramId - (Optional) Admin ID to send confirmation to.
 * @returns {Promise<object|null>} The updated user object, or null if not found.
 */
async function updateSubscription(telegramId, plan, adminTelegramId = null) {
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

    // Update the user in database
    const updatedUser = await User.findOneAndUpdate(
        { telegramId: telegramId },
        {
            subscriptionStatus: 'active',
            subscriptionPlan: plan,
            subscriptionEndDate: subscriptionEndDate,
            isSubscriptionExpired: false,
        },
        { new: true, useFindAndModify: false }
    );

    if (!updatedUser) {
        console.error(`❌ User with ID ${telegramId} not found.`);
        return null;
    }

    try {
        // 🛠️ FIX: Send congratulatory message to the USER
        const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
        const userMessage = `🎉 Congratulations! Your subscription has been manually updated to the **${planName}** plan. You now have full access to Focusly! Get started with /checkin.`;
        
        await sendTelegramMessage(null, telegramId, userMessage);
        console.log(`✅ Sent congratulatory message to user ${telegramId}`);

        // 🛠️ FIX: Send confirmation message to ADMIN (if provided)
        if (adminTelegramId) {
            const adminMessage = `✅ Successfully updated subscription for user ${telegramId} to ${plan} plan.`;
            await sendTelegramMessage(null, adminTelegramId, adminMessage);
            console.log(`✅ Sent confirmation to admin ${adminTelegramId}`);
        }

    } catch (error) {
        console.error('❌ Error sending Telegram messages:', error);
        // Don't fail the whole operation if messaging fails
    }

    return updatedUser;
}

module.exports = {
    updateSubscription,
};