const cron = require('node-cron');
const User = require('../models/user');

function startDailyReminders(bot) {
  // Run every day at 6 PM Nigeria time
  cron.schedule('0 17 * * *', async () => {
    console.log('🔔 Running daily reminder cron job...');

    try {
      const users = await User.find({
        stage: 'awaiting_tasks' // or other condition like hasn't checked in
      });

      for (const user of users) {
        const chatId = user.telegramId;
        await bot.sendMessage(chatId, `👋 Don’t forget to submit your tasks for today related to your focus: *${user.focus}*`, {
          parse_mode: 'Markdown'
        });
      }
    } catch (err) {
      console.error('Reminder job failed:', err);
    }
  }, {
    timezone: "Africa/Lagos"
  });
  const sendDailyReminder = async () => {
  const users = await User.find();

  for (const user of users) {
    const chatId = user.telegramId;
    const today = new Date().toISOString().split('T')[0];

    let checklistMessage = "";

    // 1. Manual checklist takes priority
    if (user.manualChecklist && user.manualChecklist.length > 0) {
      checklistMessage = `🌞 Here's your manual checklist for today:\n\n` +
        user.manualChecklist.map(item => `☐ ${item}`).join('\n');
    }

    // 2. If no manual checklist, fall back to dailyChecklist (AI)
    else if (user.dailyChecklist?.date?.toISOString().split('T')[0] === today &&
             user.dailyChecklist?.tasks?.length > 0) {
      checklistMessage = `🌞 Here's your AI-generated checklist for today:\n\n` +
        user.dailyChecklist.tasks.map(task => `☐ ${task.text}`).join('\n');
    }

    // 3. If no checklist at all
    else {
      checklistMessage = `🌞 Good morning! Ready to focus?\nYou don’t have a checklist yet. Reply "set checklist" to get one.`;
    }

    await bot.sendMessage(chatId, checklistMessage);
  }
};

}

module.exports = startDailyReminders;
