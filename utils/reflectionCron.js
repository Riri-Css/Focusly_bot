// File: src/cron/reflectionCrons.js - NEW FILE

const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/user');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { sendTelegramMessage } = require('../handlers/messageHandlers');

const TIMEZONE = 'Africa/Lagos';

/**
 * Sends a weekly reflection message to all users every Sunday morning.
 * @param {object} bot - The Telegram bot instance.
 */
async function sendWeeklyReflection(bot) {
    console.log('⏳ Running weekly reflection cron job...');
    const now = moment().tz(TIMEZONE);
    const startOfWeek = now.clone().startOf('week');

    try {
        const users = await User.find({
            onboardingStep: 'onboarded',
            $or: [
                { lastWeeklyReflectionDate: { $lt: startOfWeek.toDate() } },
                { lastWeeklyReflectionDate: { $exists: false } }
            ]
        });

        for (const user of users) {
            try {
                let aiResponse;
                if (user.goalMemory && user.goalMemory.text) {
                    const recentChecklists = user.checklists.filter(c => moment(c.date).isSameOrAfter(startOfWeek));
                    const recentChats = user.recentChatMemory.filter(c => moment(c.timestamp).isSameOrAfter(startOfWeek));

                    aiResponse = await getSmartResponse(user, 'weekly_reflection_with_goal', {
                        goalMemory: user.goalMemory,
                        recentChecklists: recentChecklists,
                        recentChats: recentChats,
                    });
                } else {
                    aiResponse = await getSmartResponse(user, 'motivational_message_without_goal', {});
                }

                if (aiResponse.message) {
                    await sendTelegramMessage(bot, user.telegramId, aiResponse.message);
                    user.lastWeeklyReflectionDate = now.toDate();
                    await user.save();
                    console.log(`✅ Sent weekly reflection to user ${user.telegramId}.`);
                }
            } catch (userError) {
                console.error(`❌ Error processing weekly reflection for user ${user.telegramId}:`, userError);
            }
        }
        console.log('✅ Weekly reflection cron job finished.');
    } catch (error) {
        console.error('❌ Error in weekly reflection cron job:', error);
    }
}

/**
 * Sends a monthly reflection message to all users on the last day of the month.
 * @param {object} bot - The Telegram bot instance.
 */
async function sendMonthlyReflection(bot) {
    console.log('⏳ Running monthly reflection cron job...');
    const now = moment().tz(TIMEZONE);
    const startOfMonth = now.clone().startOf('month');

    if (!now.isSame(now.clone().endOf('month'), 'day')) {
        console.log('🗓️ Not the last day of the month. Skipping monthly reflection.');
        return;
    }

    try {
        const users = await User.find({
            onboardingStep: 'onboarded',
            $or: [
                { lastMonthlyReflectionDate: { $lt: startOfMonth.toDate() } },
                { lastMonthlyReflectionDate: { $exists: false } }
            ]
        });

        for (const user of users) {
            try {
                let aiResponse;
                if (user.goalMemory && user.goalMemory.text) {
                    const recentChecklists = user.checklists.filter(c => moment(c.date).isSameOrAfter(startOfMonth));
                    const recentChats = user.recentChatMemory.filter(c => moment(c.timestamp).isSameOrAfter(startOfMonth));

                    aiResponse = await getSmartResponse(user, 'monthly_reflection_with_goal', {
                        goalMemory: user.goalMemory,
                        recentChecklists: recentChecklists,
                        recentChats: recentChats,
                    });
                } else {
                    aiResponse = await getSmartResponse(user, 'motivational_message_without_goal', {});
                }

                if (aiResponse.message) {
                    await sendTelegramMessage(bot, user.telegramId, aiResponse.message);
                    user.lastMonthlyReflectionDate = now.toDate();
                    await user.save();
                    console.log(`✅ Sent monthly reflection to user ${user.telegramId}.`);
                }
            } catch (userError) {
                console.error(`❌ Error processing monthly reflection for user ${user.telegramId}:`, userError);
            }
        }
        console.log('✅ Monthly reflection cron job finished.');
    } catch (error) {
        console.error('❌ Error in monthly reflection cron job:', error);
    }
}

/**
 * Schedules the reflection crons to run on a set schedule.
 * @param {object} bot - The Telegram bot instance.
 */
function startReflectionCrons(bot) {
    // Weekly reflection runs every Sunday at 9:00 AM.
    cron.schedule('0 9 * * 0', () => sendWeeklyReflection(bot), {
        scheduled: true,
        timezone: TIMEZONE,
    });

    // Monthly reflection runs on the last day of the month at 9:00 AM.
    cron.schedule('0 9 L * *', () => sendMonthlyReflection(bot), {
        scheduled: true,
        timezone: TIMEZONE,
    });
}

module.exports = {
    startReflectionCrons,
};