const cron = require('node-cron');
const User = require('../models/User');

function setupCronJobs(bot) {
  // Removed duplicate: const cron = require('node-cron');
  // ❌ Removed: const bot = require('../bot');

  cron.schedule('0 8 * * *', async () => {
    const users = await User.find({ dailyChecklist: { $exists: true } });

    for (const user of users) {
      const chatId = user.chatId;

      if (user.manualChecklist && user.manualChecklist.length > 0) {
        bot.sendMessage(
          chatId,
          `🌞 Here's your checklist for today:\n` +
          user.manualChecklist.map((item, i) => `☐ ${item}`).join('\n')
        );
      } else {
        const todayTask = user.dailyChecklist?.[0] || 'No task found for today.';
        await bot.sendMessage(chatId, `📝 Here's your checklist for today:\n${todayTask}`);
      }
    }
  });

  cron.schedule('0 12 * * *', async () => {
    const users = await User.find({ dailyChecklist: { $exists: true } });

    for (const user of users) {
      await bot.sendMessage(
        user.chatId,
        `🔔 Hope you're making progress on your task today! Stay focused 💪`
      );
    }
  });

  // 🕗 8PM reminder to complete tasks
  cron.schedule('0 20 * * *', async () => {
    console.log('🔔 Sending 8PM task reminders');

    try {
      const users = await User.find({ hasCheckedInToday: false });

      for (const user of users) {
        await bot.sendMessage(
          user.telegramId,
          `👋 Hey ${user.name}, have you completed your tasks for today?\nReply with ✅ if yes, ❌ if not.`
        );
      }
    } catch (error) {
      console.error('❌ Error sending 8PM reminders:', error);
    }
  });

  // 🌙 9PM strict check-in reminder
  cron.schedule('0 21 * * *', async () => {
    console.log('⏰ Sending 9PM check-in reminders');

    try {
      const today = new Date().toISOString().split('T')[0];
      const users = await User.find({});

      for (const user of users) {
        const chatId = user.telegramId;

        if (user.lastCheckInDate === today) {
          await bot.sendMessage(
            chatId,
            `🌙 Daily Wrap-up:\n\n✅ You checked in today!\n🔥 Streak: ${user.streak} days\n🎯 Focus: *${user.focus}*\n\nKeep the fire alive!`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await bot.sendMessage(
            chatId,
            `⚠️ ${user.name}, you haven’t checked in today.\n\nWhat’s really stopping you?\nYou made a promise to stay focused. Don't break it.\nSend ✅ if you made progress, ❌ if not.`
          );
        }
      }
    } catch (error) {
      console.error('❌ Error in 9PM check-in reminders:', error);
    }
  });

  // 🌅 Midnight reset
  cron.schedule('0 0 * * *', async () => {
    console.log('🔁 Resetting daily check-in flags at midnight');

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yyyymmdd = yesterday.toISOString().split('T')[0];

      const users = await User.find({});

      for (const user of users) {
        const lastCheckIn = new Date(user.lastCheckInDate).toISOString().split('T')[0];

        if (lastCheckIn !== yyyymmdd) {
          user.streak = 0; // missed yesterday, reset streak
        }

        user.hasCheckedInToday = false;
        await user.save();
      }

      console.log('✅ Streaks updated and flags reset');
    } catch (err) {
      console.error('❌ Error resetting flags at midnight:', err);
    }
  });
}
cron.schedule('0 10 * * *', async () => {
  const users = await User.find({ subscriptionEndDate: { $exists: true } });

  const today = new Date();
  for (const user of users) {
    const daysLeft = Math.ceil((new Date(user.subscriptionEndDate) - today) / (1000 * 60 * 60 * 24));

    if (daysLeft === 3 || daysLeft === 1) {
      await bot.sendMessage(
        user.telegramId,
        `⏳ Your Focusly subscription will expire in ${daysLeft} day(s). Please renew to avoid losing access.`
      );
    }
  }
});


module.exports = setupCronJobs;
