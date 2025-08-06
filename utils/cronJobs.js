// File: src/utils/cronJobs.js
const cron = require('node-cron');
const User = require('../models/user');
const { sendTelegramMessage } = require('./telegram');
const { generateChecklist } = require('./generateChecklist');
const { getModelForUser } = require('../utils/subscriptionUtils');

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

  // ⏰ 12 PM Reminder
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

  // ⏰ 3 PM Progress Reminder
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

  // ⏰ 6 PM Progress Reminder
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

  // ⏰ 9 PM Check-in Reminder and Streak Reset
  cron.schedule('0 21 * * *', async () => {
    try {
      const users = await User.find();
      for (const user of users) {
        const today = new Date().toDateString();
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        const hasCheckedInToday = lastChecklist && new Date(lastChecklist.date).toDateString() === today && lastChecklist.checkedIn;
        if (lastChecklist && new Date(lastChecklist.date).toDateString() === today && !lastChecklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "It’s 9PM! Time to check in. How did you do with your tasks today?");
        }
        if (!hasCheckedInToday && user.checklists?.length) {
          await sendTelegramMessage(user.telegramId, "Hey! You haven't checked in today. Please let me know how your day went.");
          user.missedCheckins = (user.missedCheckins || 0) + 1;
          await user.save();
        }
      }
    } catch (err) {
      console.error('9 PM cron error:', err.message);
    }
  }, {
    timezone: TIMEZONE
  });
}

module.exports = { startDailyJobs };