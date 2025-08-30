// File: src/utils/reminderScheduler.js - FINAL CORRECTED VERSION
const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/user');
const { sendTelegramMessage } = require('./telegram');

const TIMEZONE = 'Africa/Lagos';

function startTaskReminderScheduler(bot) {
    // ⏰ Task Reminders (every minute)
    // This job checks for any daily checklist tasks with a time that have not been reminded yet.
    cron.schedule('* * * * *', async () => {
        console.log('⏰ Checking daily task reminders...');
        try {
            const now = moment().tz(TIMEZONE);
            const today = now.startOf('day').toDate();

            const users = await User.find({ onboarded: true });

            for (const user of users) {
                const checklist = user.checklists.find(c => moment(c.date).isSame(today, 'day'));

                if (checklist && !checklist.checkedIn) {
                    for (const task of checklist.tasks) {
                        if (task.time && !task.reminded) {
                            const [hour, minute] = task.time.split(':').map(Number);
                            const taskTime = moment().tz(TIMEZONE).set({ hour, minute, second: 0, millisecond: 0 });

                            // Check if the current time is past or equal to the task time
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
            }
        } catch (err) {
            console.error('❌ Task reminder cron error:', err.message);
        }
    }, { timezone: TIMEZONE });
}

module.exports = { startTaskReminderScheduler };