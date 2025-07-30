const cron = require('node-cron');
const User = require('../models/user');
//const { sendTelegramMessage } = require('./utils/telegram');
const { generateChecklist } = require('./generateChecklist');
const { generateWeeklyChecklist } = require('../helpers/generateWeeklyChecklist');

// ⏰ 8 AM Daily Reminder: For users who haven't submitted tasks
cron.schedule('0 8 * * *', async () => {
  try {
    const users = await User.find({ onboarded: true });
    for (const user of users) {
      const today = new Date().toDateString();
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
cron.schedule('0 12 * * *', async () => {
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

// 🧠 Weekly Checklist Generator – every Monday at 6 AM
cron.schedule('0 6 * * 1', async () => {
  try {
    const users = await User.find({ onboarded: true });
    for (const user of users) {
      const access = user.subscription?.status;
      if (access === 'trial' || access === 'basic' || access === 'premium') {
        await generateWeeklyChecklist(user.telegramId);
      }
    }
  } catch (err) {
    console.error('Weekly checklist cron error:', err.message);
  }
});

module.exports = cron;
