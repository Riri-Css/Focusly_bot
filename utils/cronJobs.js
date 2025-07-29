const cron = require('node-cron');
const User = require('../models/user');
const generateChecklist = require('../utils/generateChecklist');

function setupCronJobs(bot) {
  // 🕗 8AM - Generate and send checklist
  cron.schedule('0 8 * * *', async () => {
    const users = await User.find({});
    const today = new Date().toISOString().split('T')[0];

    for (const user of users) {
      const chatId = user.telegramId;

      if (!user.dailyChecklist || user.lastCheckInDate !== today) {
        const checklist = await generateChecklist(user.focus);
        user.dailyChecklist = checklist;
        user.lastCheckInDate = today;
        await user.save();

        await bot.sendMessage(
          chatId,
          `🌞 Here's your checklist for today:\n` + checklist.map((task, i) => `☐ ${task}`).join('\n')
        );
      }
    }
  });

  // 🕛 12PM - Reminder to stay focused
  cron.schedule('0 12 * * *', async () => {
    const users = await User.find({});
    for (const user of users) {
      await bot.sendMessage(user.telegramId, `🔔 Hope you're making progress on your task today! Stay focused 💪`);
    }
  });

  // 🕒 3PM - Reminder: How's it going
  cron.schedule('0 15 * * *', async () => {
    const users = await User.find({});
    for (const user of users) {
      await bot.sendMessage(user.telegramId, `📣 Quick check-in: How’s the task going so far? Need help staying on track?`);
    }
  });

  // 🕕 6PM - Reminder to complete before check-in
  cron.schedule('0 18 * * *', async () => {
    const users = await User.find({ hasCheckedInToday: false });
    for (const user of users) {
      await bot.sendMessage(user.telegramId, `⏰ It's 6PM! Start rounding up your checklist before nightfall! 💼`);
    }
  });

  // 🌙 9PM - Strict check-in reminder
  cron.schedule('0 21 * * *', async () => {
    console.log('⏰ Sending 9PM check-in reminders');
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
          `⚠️ ${user.name}, you haven’t checked in today.\n\nWhat’s really stopping you?\nYou made a promise to stay focused. Don’t break it.\nSend ✅ if you made progress, ❌ if not.`
        );
      }
    }
  });

  // 🌅 Midnight reset
  cron.schedule('0 0 * * *', async () => {
    console.log('🔁 Resetting daily check-in flags at midnight');
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
  });

  // 🔔 Subscription expiry alerts
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
}

module.exports = setupCronJobs;
