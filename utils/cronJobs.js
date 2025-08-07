// File: src/utils/cronJobs.js
const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/user');
const { sendTelegramMessage } = require('./telegram');
const { generateChecklist } = require('./generateChecklist');
const { getModelForUser } = require('../utils/subscriptionUtils');
const { getChecklistByDate } = require('../controllers/userController');

const TIMEZONE = 'Africa/Lagos';

function startDailyJobs(bot) {
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
      const users = await User.find({ 'goalMemory.text': { $exists: true, $ne: '' } });

      for (const user of users) {
        const model = await getModelForUser(user);
        const goal = user.goalMemory.text;

        const checklistMessage = await generateChecklist(user, goal, model);

        if (checklistMessage) {
          await sendTelegramMessage(user.telegramId, checklistMessage);
          console.log(`✅ Sent 8 AM checklist to user ${user.telegramId}`);
        } else {
          await sendTelegramMessage(user.telegramId, "I couldn't generate a checklist for you today. Let's re-examine your goal.");
          console.log(`⚠️ Failed to generate 8 AM checklist for user ${user.telegramId}`);
        }
      }
    } catch (err) {
      console.error('❌ 8 AM daily checklist cron error:', err.message);
    }
  }, { timezone: TIMEZONE });

  // ⏰ 12 PM Progress Reminder (Restored)
  cron.schedule('0 1 41 * *', async () => {
    console.log('⏰ Running 12 PM reminder...');
    try {
      const users = await User.find();
      for (const user of users) {
        const today = new Date().toDateString();
        const hasChecklistToday = user.checklists.some(c => new Date(c.date).toDateString() === today);
        if (user.goalMemory && !hasChecklistToday) {
          await sendTelegramMessage(user.telegramId, "Hey, just checking in! It seems your daily checklist wasn't generated. Let's make sure your goal is set correctly.");
          console.log(`✅ Sent 12 PM reminder to user ${user.telegramId}`);
        }
      }
    } catch (err) {
      console.error('❌ 12 PM cron error:', err.message);
    }
  }, { timezone: TIMEZONE });

  // ⏰ 3 PM Progress Reminder (Restored)
  cron.schedule('0 15 * * *', async () => {
    console.log('⏰ Running 3 PM progress reminder...');
    try {
      const users = await User.find();
      for (const user of users) {
        const today = moment().tz(TIMEZONE).toDate();
        const checklist = await getChecklistByDate(user._id, today);
        if (checklist && !checklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "It’s 3 PM! How’s your day going? Have you made progress on your tasks? At least by now you suppose dey round up o make you sef rest but na only if you don do something progressive.");
          console.log(`✅ Sent 3 PM reminder to user ${user.telegramId}`);
        }
      }
    } catch (err) {
      console.error('❌ 3 PM cron error:', err.message);
    }
  }, { timezone: TIMEZONE });

  // ⏰ 6 PM Progress Reminder (Restored)
  cron.schedule('0 18 * * *', async () => {
    console.log('⏰ Running 6 PM progress reminder...');
    try {
      const users = await User.find();
      for (const user of users) {
        const today = moment().tz(TIMEZONE).toDate();
        const checklist = await getChecklistByDate(user._id, today);
        if (checklist && !checklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "It’s 6 PM! How’s your evening going? Hope you're almost done with your tasks because excuses will be accepted? I just make I yarn you and if you come with excuse, me sef dey gidigba for you!");
          console.log(`✅ Sent 6 PM reminder to user ${user.telegramId}`);
        }
      }
    } catch (err) {
      console.error('❌ 6 PM cron error:', err.message);
    }
  }, { timezone: TIMEZONE });

  // ⏰ 9 PM Dedicated Check-in Reminder (Retained)
  cron.schedule('0 21 * * *', async () => {
    console.log('⏰ Running 9 PM check-in reminder...');
    try {
      const users = await User.find();
      for (const user of users) {
        const today = moment().tz(TIMEZONE).toDate();
        const checklist = await getChecklistByDate(user._id, today);
        if (checklist && !checklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "Hey! It's 9 PM. Have you checked in today? Let me know how your day went!");
          console.log(`✅ Sent 9 PM reminder to user ${user.telegramId}`);
        }
      }
    } catch (err) {
      console.error('❌ 9 PM reminder cron error:', err.message);
    }
  }, { timezone: TIMEZONE });

  // ⏰ 11:59 PM Missed Check-in & Streak Reset (Retained)
  cron.schedule('59 23 * * *', async () => {
    console.log('⏰ Running 11:59 PM missed check-in job...');
    const today = moment().tz(TIMEZONE).toDate();
    try {
      const users = await User.find({});
      for (const user of users) {
        const checklist = await getChecklistByDate(user._id, today);
        if (checklist && !checklist.checkedIn) {
          user.currentStreak = 0;
          user.missedCheckins = (user.missedCheckins || 0) + 1;
          await user.save();
          console.log(`⚠️ User ${user.telegramId} missed check-in. Streak reset.`);
        } else if (checklist && checklist.checkedIn) {
          const yesterday = moment().tz(TIMEZONE).subtract(1, 'day').toDate();
          const yesterdayChecklist = await getChecklistByDate(user._id, yesterday);
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
          await sendTelegramMessage(user.telegramId, reflectionMessage);
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
                await sendTelegramMessage(user.telegramId, reflectionMessage);
                console.log(`✅ Sent monthly report to user ${user.telegramId}`);
            }
        }
    } catch (err) {
        console.error('❌ Monthly reflection cron error:', err.message);
    }
  }, { timezone: TIMEZONE });
}

module.exports = { startDailyJobs };