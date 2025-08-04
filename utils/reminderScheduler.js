const User = require('../models/user');
const { sendTelegramMessage } = require('./telegram');

// Function to schedule individual reminders dynamically
async function scheduleCustomReminders(bot) {
  try {
    const users = await User.find({ onboarded: true });

    for (const user of users) {
      // Only schedule if user has tasks for today
      const today = new Date().toDateString();
      const lastChecklist = user.checklists?.[user.checklists.length - 1];

      if (
        lastChecklist &&
        new Date(lastChecklist.date).toDateString() === today &&
        lastChecklist.tasks.length > 0 &&
        !lastChecklist.checkedIn
      ) {
        for (const task of lastChecklist.tasks) {
          if (task.time && !task.reminded) {
            const [hour, minute] = task.time.split(':').map(Number);
            const now = new Date();
            const reminderTime = new Date();
            reminderTime.setHours(hour, minute, 0, 0);

            const delay = reminderTime - now;
            if (delay > 0) {
              setTimeout(async () => {
                await sendTelegramMessage(user.telegramId, `⏰ Reminder: ${task.task}`);
                task.reminded = true;
                await user.save();
              }, delay);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Reminder scheduling error:', err.message);
  }
}
require('./cronJobs');

module.exports = { scheduleCustomReminders };
