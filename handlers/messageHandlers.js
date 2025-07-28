const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/user');
const getSmartResponse = require('../utils/getSmartResponse');
const { getDailyChecklist, getWeeklyChecklist } = require('../utils/generateChecklist');
const { checkAccess } = require('../utils/subscriptionUtils');

module.exports = function handleMessages(bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    const telegramId = msg.from.id.toString();

    try {
      const user = await findOrCreateUser(telegramId);

      // Access control fix
      if (!(await checkAccess(telegramId))) {
        await bot.sendMessage(chatId, '⛔ Your free trial has ended. Please subscribe to continue using Focusly.');
        return;
      }

      // /start command fix with return
      if (text === '/start') {
        if (user.stage && user.stage !== 'completed_onboarding') {
          await bot.sendMessage(chatId, 'Welcome back! Want to pick up where you left off?');
        } else {
          await bot.sendMessage(chatId, 'Welcome! What’s your name?');
          user.stage = 'awaiting_name';
          await user.save();
        }
        return;
      }

      // Fallback onboarding if user didn't use /start
      if (user.stage === 'awaiting_name') {
        await bot.sendMessage(chatId, 'Hi! What’s your name?');
        return;
      }

      // Name handling
      if (user.stage === 'awaiting_name') {
        user.name = text;
        user.stage = 'awaiting_focus';
        await user.save();
        await bot.sendMessage(chatId, `Nice to meet you, ${user.name}! What's your current focus area or goal?`);
        return;
      }

      // Focus area input
      if (user.stage === 'awaiting_focus') {
        user.focusArea = text;
        user.stage = 'awaiting_daily_tasks';
        await user.save();
        await bot.sendMessage(chatId, `Great! What are your main tasks for today to make progress in "${user.focusArea}"?`);
        return;
      }

      // Daily tasks input
      if (user.stage === 'awaiting_daily_tasks') {
        user.dailyTasks = text;
        user.stage = 'completed_onboarding';
        user.streak = 0;
        user.lastCheckInDate = null;
        await user.save();
        await bot.sendMessage(chatId, 'Awesome! You’re all set. I’ll check in with you later today to see your progress. Stay focused!');
        return;
      }

      // Evening check-in
      if (user.stage === 'completed_onboarding' && /\b(done|not done|✅|❌)\b/i.test(text)) {
        const today = new Date().toDateString();
        const lastCheckIn = user.lastCheckInDate ? new Date(user.lastCheckInDate).toDateString() : null;

        if (today === lastCheckIn) {
          await bot.sendMessage(chatId, 'You already checked in for today. Great job! ✅');
        } else {
          const didCompleteTasks = /\b(done|✅)\b/i.test(text);
          if (didCompleteTasks) {
            user.streak = (user.streak || 0) + 1;
            await bot.sendMessage(chatId, `✅ Nice work today! Your current streak is ${user.streak} days.`);

            if (user.streak > 0 && user.streak % 7 === 0) {
              await bot.sendMessage(chatId, `🎉 Milestone: ${user.streak} day streak! You're on fire 🔥`);
            }
          } else {
            user.streak = 0;
            const smartFeedback = await getSmartResponse(user, false);
            await bot.sendMessage(chatId, smartFeedback);
          }

          user.lastCheckInDate = new Date();
          await user.save();
        }
        return;
      }

      // Daily/Weekly checklist or smart response
      const lowerText = text.toLowerCase();
      if (lowerText.includes('checklist') || lowerText.includes('what should') || lowerText.includes('todo')) {
        const checklist = await getDailyChecklist(user);
        await bot.sendMessage(chatId, `📝 Here's a checklist for today:
${checklist}`);
        return;
      } else if (lowerText.includes('week plan') || lowerText.includes('weekly') || lowerText.includes('this week')) {
        const checklist = await getWeeklyChecklist(user);
        await bot.sendMessage(chatId, `📆 Here's your weekly checklist:
${checklist}`);
        return;
      }

      // Smart fallback for free talk or motivation
      const reply = await getSmartResponse(user, null, text);
      await bot.sendMessage(chatId, reply);
    } catch (error) {
      console.error('Error handling message:', error);
      await bot.sendMessage(chatId, '❌ An unexpected error occurred. Please try again later.');
    }
  });
};

async function findOrCreateUser(telegramId) {
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = new User({ telegramId });
    await user.save();
  }
  return user;
}
