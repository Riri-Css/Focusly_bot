const cron = require('node-cron');
const User = require('../models/user');
const { sendTelegramMessage } = require('./telegram');
const { generateChecklist } = require('./generateChecklist');
const { generateWeeklyChecklist } = require('../helpers/generateWeeklyChecklist');

function startDailyJobs(bot) {
  // ⏰ 8 AM Daily Reminder: For users who haven't submitted tasks
  cron.schedule('0 8 * * *', async () => {
    try {
      const users = await User.find({ onboarded: true, hasActiveChecklist: false });
      for (const user of users) {
        const today = new Date().toDateString();
        if (!user.subscribed || !user.dailyTasks || user.dailyTasks.length === 0) continue;
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        if (!lastChecklist || new Date(lastChecklist.date).toDateString() !== today) {
          await sendTelegramMessage(user.telegramId, "Good morning! Don’t forget to set your focus for today. Type it here now.");
        }
      }
    } catch (err) {
      console.error('8AM cron error:', err.message);
    }
  });

  // ⏰ 12 PM Reminder: If no tasks submitted yet
  cron.schedule('0 9 * * *', async () => {
    try {
      const users = await User.find({ onboarded: true });
      for (const user of users) {
        const today = new Date().toDateString();
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        if (!lastChecklist || new Date(lastChecklist.date).toDateString() !== today || lastChecklist.tasks.length === 0) {
          await sendTelegramMessage(user.telegramId, "Hey, just checking in! Don’t forget to submit today’s focus checklist.");
        }
      }
    } catch (err) {
      console.error('12PM cron error:', err.message);
    }
  });

  cron.schedule('0 15 * * *', async () => {
    try {
      const users = await User.find({ onboarded: true });
      for (const user of users) {
        const today = new Date().toDateString();
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        if (lastChecklist && new Date(lastChecklist.date).toDateString() === today && !lastChecklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "It’s 3 PM! How’s your day going? Have you made progress on your tasks?");
        }
      }
    } catch (err) {
      console.error('3PM cron error:', err.message);
    }
  });

  cron.schedule('0 18 * * *', async () => {
    try {
      const users = await User.find({ onboarded: true });
      for (const user of users) {
        const today = new Date().toDateString();
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        if (lastChecklist && new Date(lastChecklist.date).toDateString() === today && !lastChecklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "It’s 6 PM! How’s your evening going? Hope you're almost done with your tasks because excuses will be accepted?");
        }
      }
    } catch (err) {
      console.error('6PM cron error:', err.message);
    }
  });

  // ⏰ 9 PM Check-in Reminder
  cron.schedule('0 21 * * *', async () => {
    try {
      const users = await User.find({ onboarded: true });
      for (const user of users) {
        const today = new Date().toDateString();
        const lastChecklist = user.checklists?.[user.checklists.length - 1];
        if (lastChecklist && new Date(lastChecklist.date).toDateString() === today && !lastChecklist.checkedIn) {
          await sendTelegramMessage(user.telegramId, "It’s 9PM! Time to check in. How did you do with your tasks today?");
        }
      }
    } catch (err) {
      console.error('9PM cron error:', err.message);
    }
  });

  // 🧠 Weekly Checklist Generator – every Monday at 8 AM
  cron.schedule('0 8 * * 1', async () => {
    try {
      const users = await User.find({ onboarded: true });
      for (const user of users) {
        const access = user.subscription?.status;
        if (access === 'trial' || access === 'basic' || access === 'premium') {
          await generateWeeklyChecklist(user, user.focus || "Your main goal");
        }
      }
    } catch (err) {
      console.error('Weekly checklist cron error:', err.message);
    }
  });
}

module.exports = { startDailyJobs };
