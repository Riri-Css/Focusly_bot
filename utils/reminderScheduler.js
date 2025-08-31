// File: src/utils/reminderScheduler.js - FIXED WITH MINI GOALS
const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/user');
const MiniGoal = require('../models/miniGoal');   // import mini-goal model
const { sendTelegramMessage } = require('./telegram');

const TIMEZONE = 'Africa/Lagos';

function startTaskReminderScheduler(bot) {
    // ⏰ Task Reminders (every minute)
    cron.schedule('* * * * *', async () => {
        console.log('⏰ Checking daily task reminders...');
        try {
            const now = moment().tz(TIMEZONE);
            const today = now.startOf('day').toDate();

            const users = await User.find({ onboarded: true });

            for (const user of users) {
                // --- Daily checklist tasks ---
                const checklist = user.checklists.find(c => moment(c.date).isSame(today, 'day'));

                if (checklist && !checklist.checkedIn) {
                    for (const task of checklist.tasks) {
                        if (task.time && !task.reminded) {
                            const [hour, minute] = task.time.split(':').map(Number);
                            const taskTime = moment().tz(TIMEZONE).set({ hour, minute, second: 0, millisecond: 0 });

                            if (now.isSameOrAfter(taskTime, 'minute')) {
                                try {
                                    await sendTelegramMessage(bot, user.telegramId, `⏰ Reminder: ${task.task}`);
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

                const miniGoals = await MiniGoal.find({ userId: user._id, reminded: false });

                for (const goal of miniGoals) {
                    const goalTime = moment(goal.time).tz(TIMEZONE);

                    if (now.isSameOrAfter(goalTime, "minute")) {
                        try {
                            await sendTelegramMessage(
                                bot,
                                user.telegramId,
                                `🎯 Mini Goal Reminder: ${goal.text}`
                            );
                        } catch (err) {
                                console.error(
                                    `❌ Error sending mini-goal reminder for user ${user.telegramId}:`,
                                    err.message
                                );
                            }

                        goal.reminded = true; // mark so it won’t repeat
                        await goal.save();

                        console.log(`✅ Sent mini-goal reminder to user ${user.telegramId}: ${goal.text}`);
                    } 
                }
            }
        } catch (err) {
            console.error(
                `❌ Error sending mini-goal reminder for user:`,
                err.message
            );
        }
    }, { timezone: TIMEZONE });
}

module.exports = { startTaskReminderScheduler };
