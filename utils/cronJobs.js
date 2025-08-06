// File: src/utils/cronJobs.js
const cron = require('node-cron');
const User = require('../models/user');
const { sendTelegramMessage } = require('./telegram');
const { generateChecklist } = require('./generateChecklist');
const { getModelForUser } = require('../utils/subscriptionUtils');
const { getChecklistByDate } = require('../controllers/userController');

// The timezone for Nigeria is 'Africa/Lagos'
const TIMEZONE = 'Africa/Lagos';

function startDailyJobs() {
  // ⏰ 8 AM Daily Checklist Generator
  cron.schedule('0 8 * * *', async () => {
    try {
      const users = await User.find({ 'goalMemory.text': { $exists: true, $ne: '' } });

      for (const user of users) {
        const model = await getModelForUser(user);
        const goal = user.goalMemory.text;
        
        const checklistMessage = await generateChecklist(user, goal, model);
        
        if (checklistMessage) {
          await sendTelegramMessage(user.telegramId, checklistMessage);
        } else {
           await sendTelegramMessage(user.telegramId, "I couldn't generate a checklist for you today. Let's re-examine your goal.");
        }
      }
    } catch (err) {
      console.error('8 AM daily checklist cron error:', err.message);
    }
  }, {
    timezone: TIMEZONE
  });

  // ⏰ 12 PM Reminder (unchanged)
  cron.schedule('0 13 * * *', async () => {
    try {
      const users = await User.find();
      for (const user of users) {
        const today = new Date().toDateString();
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        if (!lastChecklist || new Date(lastChecklist.date).toDateString() !== today) {
          await sendTelegramMessage(user.telegramId, "Hey, just checking in! How's it going, hope you're still focused or you've gone to distract yourself? Remember what's stopping you from achieving your goal is the action you've not taken yet.");
        }
      }
    } catch (err) {
      console.error('12 PM cron error:', err.message);
    }
  }, {
    timezone: TIMEZONE
  });

  // ⏰ 3 PM Progress Reminder (unchanged)
  cron.schedule('0 15 * * *', async () => {
    try {
      const users = await User.find();
      for (const user of users) {
        const today = new Date().toDateString();
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        if (lastChecklist && new Date(lastChecklist.date).toDateString() === today && !lastChecklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "It’s 3 PM! How’s your day going? Have you made progress on your tasks? At least by now you suppose dey round up o make you sef rest but na only if you don do something progressive.");
        }
      }
    } catch (err) {
      console.error('3 PM cron error:', err.message);
    }
  }, {
    timezone: TIMEZONE
  });

  // ⏰ 6 PM Progress Reminder (unchanged)
  cron.schedule('0 18 * * *', async () => {
    try {
      const users = await User.find();
      for (const user of users) {
        const today = new Date().toDateString();
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        if (lastChecklist && new Date(lastChecklist.date).toDateString() === today && !lastChecklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "It’s 6 PM! How’s your evening going? Hope you're almost done with your tasks because excuses will be accepted? I just make I yarn you and if you come with excuse, me sef dey gidigba for you!");
        }
      }
    } catch (err) {
      console.error('6 PM cron error:', err.message);
    }
  }, {
    timezone: TIMEZONE
  });

  // ⏰ 9 PM Check-in Reminder and Streak Reset (UPDATED with corrected logic)
  cron.schedule('0 21 * * *', async () => {
    try {
      const users = await User.find();
      for (const user of users) {
        const today = new Date().toDateString();
        const hasCheckedInToday = user.checklists.some(c => new Date(c.date).toDateString() === today && c.checkedIn);
        
        if (!hasCheckedInToday) {
            // User did not check in, so we reset the streak and increment missed checkins
            user.currentStreak = 0;
            user.missedCheckins = (user.missedCheckins || 0) + 1;
            await sendTelegramMessage(user.telegramId, "Hey! You haven't checked in today. Please let me know how your day went. Your streak has been reset.");
        } else {
            // User already checked in manually, no action needed here.
            // The streak was already updated in messageHandlers.js.
            // We just need to make sure missed checkins is reset.
            user.missedCheckins = 0;
        }
        await user.save();
      }
    } catch (err) {
      console.error('9 PM cron error:', err.message);
    }
  }, {
    timezone: TIMEZONE
  });

  // --- NEW WEEKLY REFLECTION JOB ---
  // ⏰ 9 PM every Sunday for a weekly report (0 21 * * 0)
  cron.schedule('0 21 * * 0', async () => {
    try {
      const users = await User.find();
      for (const user of users) {
        const last7DaysChecklists = user.checklists
          .filter(c => new Date(c.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        
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
        }
      }
    } catch (err) {
      console.error('Weekly reflection cron error:', err.message);
    }
  }, {
    timezone: TIMEZONE
  });

  // --- NEW MONTHLY REFLECTION JOB ---
  // ⏰ 9 AM on the 1st of every month (0 9 1 * *)
  cron.schedule('0 9 1 * *', async () => {
    try {
        const users = await User.find();
        for (const user of users) {
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const thisMonthChecklists = user.checklists
                .filter(c => new Date(c.date) >= startOfMonth);

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
            }
        }
    } catch (err) {
        console.error('Monthly reflection cron error:', err.message);
    }
}, {
    timezone: TIMEZONE
});
}

module.exports = { startDailyJobs };