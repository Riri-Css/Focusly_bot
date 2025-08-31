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
    // ⏰ All Hourly/Daily Reminders
    cron.schedule('* * * * *', async () => {
        console.log('⏰ Checking all reminders...');
        try {
            const now = moment().tz(TIMEZONE);

            // --- Mini-goal reminders ---
            const dueGoals = await MiniGoal.find({
                remindAt: { $lte: new Date() },
                sent: false
            });

            for (const goal of dueGoals) {
                try {
                    await bot.sendMessage(
                        goal.userId,
                        `🎯 Mini Goal Reminder: ${goal.text}`
                    );
                    goal.sent = true;
                    await goal.save();
                    console.log(`✅ Sent mini-goal reminder to user ${goal.userId}: ${goal.text}`);
                } catch (err) {
                    console.error(`❌ Error sending mini-goal reminder for user ${goal.userId}:`, err.message);
                }
            }

            // --- Task reminders from daily checklists ---
            const today = now.startOf('day').toDate();
            const usersWithChecklist = await User.find({ 'checklists.date': today, 'onboarded': true });

            for (const user of usersWithChecklist) {
                const checklist = user.checklists.find(c => moment(c.date).isSame(today, 'day'));

                if (checklist && !checklist.checkedIn) {
                    for (const task of checklist.tasks) {
                        if (task.time && !task.reminded) {
                            const [hour, minute] = task.time.split(':').map(Number);
                            const taskTime = moment().tz(TIMEZONE).set({ hour, minute, second: 0, millisecond: 0 });

                            if (now.isSameOrAfter(taskTime, 'minute')) {
                                try {
                                    await bot.sendMessage(user.telegramId, `⏰ Reminder: ${task.task}`);
                                    task.reminded = true;
                                    await user.save();
                                    console.log(`✅ Sent task reminder to user ${user.telegramId}: ${task.task}`);
                                } catch (err) {
                                    console.error(`❌ Error sending task reminder for user ${user.telegramId}:`, err.message);
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('❌ General reminder cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 12:01 AM Daily Reset Job
    cron.schedule('1 0 * * *', async () => {
        console.log('⏰ Running daily reset job...');
        try {
            const result = await User.updateMany({}, {
                $set: {
                    hasSubmittedTasksToday: false,
                    hasCheckedInTonight: false,
                    'aiUsage.todayCount': 0,
                },
            });
            console.log(`✅ Reset daily flags for ${result.modifiedCount} users.`);
        } catch (err) {
            console.error('❌ 12:01 AM daily reset cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 8 AM Daily Checklist Generator
    cron.schedule('0 8 * * *', async () => {
        console.log('⏰ Running 8 AM daily checklist generator...');
        try {
            const users = await User.find({});
            for (const user of users) {
                try {
                    const today = moment().tz(TIMEZONE).startOf('day').toDate();
                    const existingChecklist = await getChecklistByDate(user.telegramId, today);
                    if (existingChecklist) {
                        console.log(`⚠️ User ${user.telegramId} already has a checklist for today. Skipping.`);
                        continue;
                    }
                    const userHasGoal = user.goalMemory?.text && user.goalMemory.text.trim() !== '';
                    if (!userHasGoal) {
                        const motivationalMessage = `
Good morning! ☀️ Before we can start smashing some goals, you need to set one!
A goal without a plan is just a wish. Let's make a plan. Use the command /setgoal to tell me what you want to achieve, and I'll help you break it down into actionable steps.
`;
                        await bot.sendMessage(user.telegramId, motivationalMessage);
                        console.log(`✅ Sent motivational message to user ${user.telegramId} (no goal set)`);
                    } else {
                        const aiResponse = await getSmartResponse(user, 'create_checklist', {
                            goalMemory: user.goalMemory
                        });
                        if (aiResponse.intent === 'create_checklist' && aiResponse.daily_tasks && aiResponse.daily_tasks.length > 0) {
                            const newChecklist = await createAndSaveChecklist(user.telegramId, aiResponse);
                            const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${aiResponse.weekly_goal}\n\n` + createChecklistMessage(newChecklist);
                            const keyboard = createChecklistKeyboard(newChecklist);
                            await bot.sendMessage(user.telegramId, messageText, {
                                reply_markup: keyboard,
                                parse_mode: 'Markdown'
                            });
                            console.log(`✅ Sent 8 AM checklist to user ${user.telegramId}`);
                        } else {
                            await bot.sendMessage(user.telegramId, `I couldn't generate a checklist for you today. Let's re-examine your goal. Use the command /setgoal to update your goal.`);
                            console.log(`⚠️ Failed to generate 8 AM checklist for user ${user.telegramId}`);
                        }
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
        try {
            const users = await User.find();
            for (const user of users) {
                const today = moment().tz(TIMEZONE).toDate();
                const hasCheckedIn = user.checklists.some(c => moment(c.date).isSame(today, 'day') && c.checkedIn);
                if (user.goalMemory && !hasCheckedIn) {
                    await bot.sendMessage(user.telegramId, "Hey, just checking in! Have you started working on your tasks? If not, start working on them now and let me know if you need help.");
                    console.log(`✅ Sent 12 PM reminder to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ 12 PM cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 3 PM Progress Reminder
    cron.schedule('0 15 * * *', async () => {
        console.log('⏰ Running 3 PM progress reminder...');
        try {
            const users = await User.find();
            for (const user of users) {
                const today = moment().tz(TIMEZONE).toDate();
                const hasCheckedIn = user.checklists.some(c => moment(c.date).isSame(today, 'day') && c.checkedIn);
                if (user.goalMemory && !hasCheckedIn) {
                    await bot.sendMessage(user.telegramId, "It’s 3 PM! How’s your day going? Have you made progress on your tasks? At least by now you suppose dey round up o make you sef rest but na only if you don do something progressive.");
                    console.log(`✅ Sent 3 PM reminder to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ 3 PM cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 6 PM Progress Reminder
    cron.schedule('0 18 * * *', async () => {
        console.log('⏰ Running 6 PM progress reminder...');
        try {
            const users = await User.find();
            for (const user of users) {
                const today = moment().tz(TIMEZONE).toDate();
                const hasCheckedIn = user.checklists.some(c => moment(c.date).isSame(today, 'day') && c.checkedIn);
                if (user.goalMemory && !hasCheckedIn) {
                    await bot.sendMessage(user.telegramId, "It’s 6 PM! How’s your evening going? Hope you're almost done with your tasks because excuses will not be accepted. I just make I yarn you and if you come with excuse, me sef dey gidigba for you!");
                    console.log(`✅ Sent 6 PM reminder to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ 6 PM cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 9 PM Dedicated Check-in Reminder
    cron.schedule('0 21 * * *', async () => {
        console.log('⏰ Running 9 PM check-in reminder...');
        try {
            const users = await User.find();
            for (const user of users) {
                const today = moment().tz(TIMEZONE).toDate();
                const hasCheckedIn = user.checklists.some(c => moment(c.date).isSame(today, 'day') && c.checkedIn);
                if (user.goalMemory && !hasCheckedIn) {
                    await bot.sendMessage(user.telegramId, "Hey! It's 9 PM. Have you checked in today? Let me know how your day went!");
                    console.log(`✅ Sent 9 PM reminder to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ 9 PM reminder cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 11:59 PM Missed Check-in & Streak Reset
    cron.schedule('59 23 * * *', async () => {
        console.log('⏰ Running 11:59 PM missed check-in job...');
        const today = moment().tz(TIMEZONE).toDate();
        try {
            const users = await User.find({});
            for (const user of users) {
                const checklist = await getChecklistByDate(user.telegramId, today);
                if (checklist && !checklist.checkedIn) {
                    user.currentStreak = 0;
                    user.missedCheckins = (user.missedCheckins || 0) + 1;
                    await user.save();
                    console.log(`⚠️ User ${user.telegramId} missed check-in. Streak reset.`);
                } else if (checklist && checklist.checkedIn) {
                    const yesterday = moment().tz(TIMEZONE).subtract(1, 'day').toDate();
                    const yesterdayChecklist = await getChecklistByDate(user.telegramId, yesterday);
                    if(yesterdayChecklist && yesterdayChecklist.checkedIn) {
                        user.currentStreak = (user.currentStreak || 0) + 1;
                        await user.save();
                        console.log(`📈 User ${user.telegramId} has consecutive check-in. Streak incremented.`);
                    } else {
                         user.currentStreak = 1;
                         await user.save();
                         console.log(`📈 User ${user.telegramId} has started a new streak.`);
                    }
                }
            }
        } catch (err) {
            console.error('❌ 11:59 PM cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // --- NEW WEEKLY REFLECTION JOB ---
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
                    await sendTelegramMessage(bot, user.telegramId, reflectionMessage, { parse_mode: 'Markdown' });
                    console.log(`✅ Sent weekly reflection to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ Weekly reflection cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // --- NEW MONTHLY REFLECTION JOB ---
    cron.schedule('0 9 1 * *', async () => {
        console.log('⏰ Running monthly reflection job...');
        try {
            const users = await User.find();
            for (const user of users) {
                const startOfMonth = moment().tz(TIMEZONE).startOf('month');
                const thisMonthChecklists = user.checklists
                    .filter(c => moment(c.date).isSameOrAfter(startOfMonth));
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
                    await sendTelegramMessage(bot, user.telegramId, reflectionMessage, { parse_mode: 'Markdown' });
                    console.log(`✅ Sent monthly report to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ Monthly reflection cron error:', err.message);
        }
    }, { timezone: TIMEZONE });
}

module.exports = { startDailyJobs };

