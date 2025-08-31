// File: src/utils/cronJobs.js - CONSOLIDATED & CORRECTED

const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/user');
const MiniGoal = require('../models/miniGoal');
const { sendTelegramMessage } = require('../handlers/messageHandlers');
const { getSmartResponse } = require('./getSmartResponse');
const { createAndSaveChecklist, getChecklistByDate } = require('../controllers/userController');
const { createChecklistMessage, createChecklistKeyboard } = require('../handlers/messageHandlers');

const TIMEZONE = 'Africa/Lagos';

function startDailyJobs(bot) {
    // ⏰ Mini-Goal Reminder Check
    // This runs every minute to check for any goals that are due.
    cron.schedule('* * * * *', async () => {
        console.log('⏰ Checking for due mini-goals...');
        try {
            const now = new Date();
            // Find mini-goals that are due and haven't been reminded yet
            const dueGoals = await MiniGoal.find({
                time: { $lte: now },
                reminded: false
            });

            for (const goal of dueGoals) {
                try {
                    await sendTelegramMessage(
                        bot,
                        goal.telegramId,
                        `🎯 Mini-Goal Reminder: *${goal.text}*`
                    );
                    // Mark the goal as reminded
                    goal.reminded = true;
                    await goal.save();
                    console.log(`✅ Sent mini-goal reminder to user ${goal.telegramId}: ${goal.text}`);
                } catch (err) {
                    console.error(`❌ Error sending mini-goal reminder to user ${goal.telegramId}:`, err.message);
                }
            }
        } catch (err) {
            console.error('❌ General mini-goal cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 12:01 AM Daily Reset Job
    // This runs just after midnight to handle end-of-day logistics.
    cron.schedule('1 0 * * *', async () => {
        console.log('⏰ Running daily reset and streak calculation job...');
        try {
            const yesterday = moment().tz(TIMEZONE).subtract(1, 'day').startOf('day').toDate();

            const users = await User.find({});
            for (const user of users) {
                // Find yesterday's checklist
                const yesterdayChecklist = user.checklists.find(c => moment(c.date).isSame(yesterday, 'day'));

                if (yesterdayChecklist && yesterdayChecklist.checkedIn) {
                    // User successfully checked in yesterday
                    const newStreak = (user.currentStreak || 0) + 1;
                    user.currentStreak = newStreak;
                    if (newStreak > (user.longestStreak || 0)) {
                        user.longestStreak = newStreak;
                    }
                    console.log(`📈 User ${user.telegramId} continues a streak. New streak: ${newStreak}`);
                } else {
                    // User missed a check-in yesterday
                    if (user.currentStreak > 0) {
                        console.log(`💔 User ${user.telegramId} missed a check-in. Streak reset.`);
                    }
                    user.currentStreak = 0;
                    user.missedCheckins = (user.missedCheckins || 0) + 1;
                }

                // AI usage reset for the new day
                user.aiUsage = user.aiUsage.filter(record => moment(record.date).isSame(moment(), 'day'));
                if (user.aiUsage.length === 0) {
                    user.aiUsage.push({
                        date: new Date(),
                        generalCount: 0,
                        checklistCount: 0
                    });
                }
                
                // Reset hasSubmittedTasksToday and hasCheckedInTonight
                user.hasSubmittedTasksToday = false;
                user.hasCheckedInTonight = false;

                await user.save();
            }
            console.log(`✅ Completed daily reset and streak calculations for all users.`);
        } catch (err) {
            console.error('❌ 12:01 AM daily reset cron error:', err.message);
        }
    }, { timezone: TIMEZONE });


    // ⏰ 8 AM Daily Checklist Generator
    // This job is now the only one that automatically creates a checklist.
    cron.schedule('0 8 * * *', async () => {
        console.log('⏰ Running 8 AM daily checklist generator...');
        try {
            const users = await User.find({});
            for (const user of users) {
                try {
                    const today = moment().tz(TIMEZONE).startOf('day').toDate();
                    const existingChecklist = user.checklists.find(c => moment(c.date).isSame(today, 'day'));

                    if (existingChecklist) {
                        console.log(`⚠️ User ${user.telegramId} already has a checklist for today. Skipping.`);
                        continue;
                    }

                    if (!user.goalMemory || !user.goalMemory.text || user.goalMemory.text.trim() === '') {
                        const motivationalMessage = `
Good morning! ☀️ Before we can start smashing some goals, you need to set one!
A goal without a plan is just a wish. Let's make a plan. Use the command /setgoal to tell me what you want to achieve, and I'll help you break it down into actionable steps.
`;
                        await sendTelegramMessage(bot, user.telegramId, motivationalMessage);
                        console.log(`✅ Sent motivational message to user ${user.telegramId} (no goal set)`);
                        continue;
                    }

                    const aiResponse = await getSmartResponse(user, 'create_checklist', { goalMemory: user.goalMemory });

                    if (aiResponse.intent === 'create_checklist' && aiResponse.daily_tasks && aiResponse.daily_tasks.length > 0) {
                        const newChecklist = await createAndSaveChecklist(user.telegramId, aiResponse);
                        const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${newChecklist.weeklyGoal}\n\n` + createChecklistMessage(newChecklist);
                        const keyboard = createChecklistKeyboard(newChecklist);
                        await sendTelegramMessage(bot, user.telegramId, messageText, { reply_markup: keyboard });
                        console.log(`✅ Sent 8 AM checklist to user ${user.telegramId}`);
                    } else {
                        await sendTelegramMessage(bot, user.telegramId, `I couldn't generate a checklist for you today. Let's re-examine your goal. Use the command /setgoal to update your goal.`);
                        console.log(`⚠️ Failed to generate 8 AM checklist for user ${user.telegramId}`);
                    }
                } catch (err) {
                    console.error(`❌ Error processing checklist for user ${user.telegramId}:`, err);
                }
            }
        } catch (err) {
            console.error('❌ 8 AM daily checklist cron error:', err);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 12 PM Progress Reminder
    cron.schedule('0 12 * * *', async () => {
        console.log('⏰ Running 12 PM reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
             if (user.goalMemory) {
                 await sendTelegramMessage(bot, user.telegramId, "Hey, just checking in! Have you started working on your tasks? If not, start working on them now and let me know if you need help.");
                 console.log(`✅ Sent 12 PM reminder to user ${user.telegramId}`);
             }
        }
    }, { timezone: TIMEZONE });

    // ⏰ 3 PM Progress Reminder
    cron.schedule('0 15 * * *', async () => {
        console.log('⏰ Running 3 PM progress reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
             if (user.goalMemory) {
                 await sendTelegramMessage(bot, user.telegramId, "It’s 3 PM! How’s your day going? Have you made progress on your tasks? At least by now you suppose dey round up o make you sef rest but na only if you don do something progressive.");
                 console.log(`✅ Sent 3 PM reminder to user ${user.telegramId}`);
             }
        }
    }, { timezone: TIMEZONE });

    // ⏰ 6 PM Progress Reminder
    cron.schedule('0 18 * * *', async () => {
        console.log('⏰ Running 6 PM progress reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
            if (user.goalMemory) {
                await sendTelegramMessage(bot, user.telegramId, "It’s 6 PM! How’s your evening going? Hope you're almost done with your tasks because excuses will not be accepted. I just make I yarn you and if you come with excuse, me sef dey gidigba for you!");
                console.log(`✅ Sent 6 PM reminder to user ${user.telegramId}`);
            }
        }
    }, { timezone: TIMEZONE });

    // ⏰ 9 PM Dedicated Check-in Reminder
    cron.schedule('0 21 * * *', async () => {
        console.log('⏰ Running 9 PM check-in reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
            if (user.goalMemory) {
                await sendTelegramMessage(bot, user.telegramId, "Hey! It's 9 PM. Have you checked in today? Let me know how your day went!");
                console.log(`✅ Sent 9 PM reminder to user ${user.telegramId}`);
            }
        }
    }, { timezone: TIMEZONE });

    // --- NEW WEEKLY REFLECTION JOB (Sunday at 9 PM) ---
    cron.schedule('0 21 * * 0', async () => {
        console.log('⏰ Running weekly reflection job...');
        try {
            const users = await User.find();
            for (const user of users) {
                const last7DaysChecklists = user.checklists
                    .filter(c => moment(c.date).isAfter(moment().subtract(7, 'days')));

                if (last7DaysChecklists.length > 0) {
                    const completedTasksCount = last7DaysChecklists.reduce((sum, checklist) =>
                        sum + checklist.tasks.filter(task => task.completed).length, 0);
                    const totalTasksCount = last7DaysChecklists.reduce((sum, checklist) =>
                        sum + checklist.tasks.length, 0);

                    const reflectionMessage = `
**Weekly Reflection** ✨
You've completed **${completedTasksCount}** out of **${totalTasksCount}** tasks this past week!
Your current check-in streak is **${user.currentStreak || 0} days**. Let's aim to keep it going strong! 💪
`;
                    await sendTelegramMessage(bot, user.telegramId, reflectionMessage);
                    console.log(`✅ Sent weekly reflection to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ Weekly reflection cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // --- NEW MONTHLY REFLECTION JOB (First day of the month at 9 AM) ---
    cron.schedule('0 9 1 * *', async () => {
        console.log('⏰ Running monthly reflection job...');
        try {
            const users = await User.find();
            for (const user of users) {
                const startOfMonth = moment().tz(TIMEZONE).startOf('month');
                const thisMonthChecklists = user.checklists.filter(c => moment(c.date).isSameOrAfter(startOfMonth));

                if (thisMonthChecklists.length > 0) {
                    const completedTasksCount = thisMonthChecklists.reduce((sum, checklist) =>
                        sum + checklist.tasks.filter(task => task.completed).length, 0);
                    const totalTasksCount = thisMonthChecklists.reduce((sum, checklist) =>
                        sum + checklist.tasks.length, 0);
                    
                    const reflectionMessage = `
**Monthly Report** 🗓️
This month, you completed **${completedTasksCount}** out of **${totalTasksCount}** tasks!
Your longest streak so far is **${user.longestStreak || 0} days**. Great work! 🎉
`;
                    await sendTelegramMessage(bot, user.telegramId, reflectionMessage);
                    console.log(`✅ Sent monthly report to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ Monthly reflection cron error:', err.message);
        }
    }, { timezone: TIMEZONE });
}

module.exports = { startDailyJobs };