require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const handleMessage = require('./handlers/messageHandlers');
const cron = require('node-cron');
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });

const startDailyReminders = require('./utils/cronJobs');
startDailyReminders(bot);

// 🕗 Daily check-in reminder at 8 PM
cron.schedule('0 20 * * *', async () => {
  console.log('🔔 Running daily check-in reminders at 8PM');

  try {
    const users = await User.find({ hasCheckedInToday: false });

    for (const user of users) {
      await bot.sendMessage(user.telegramId, `👋 Hey ${user.name}, have you completed your tasks for today?\nReply with ✅ if yes, ❌ if not.`);
    }

  } catch (error) {
    console.error('❌ Error sending daily check-in reminders:', error);
  }
});

// 🌙 Reset check-in flags daily at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    await User.updateMany({}, { hasCheckedInToday: false });
    console.log('🔄 Reset all check-in flags at midnight');
  } catch (err) {
    console.error('❌ Error resetting check-in flags:', err);
  }
});


// Handle incoming messages
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();

  const user = await findOrCreateUser(telegramId);

  if (user.stage !== 'completed_onboarding') {
    // Continue onboarding
    await bot.sendMessage(chatId, 'Let’s get you started again...');
    return handleMessage(bot, msg, true);
  } else {
    // Returning user
    return bot.sendMessage(chatId, `👋 Welcome back, *${user.name}*!\nYour focus is still *${user.focus}*.\n\nWhat would you like to do today?\n\n1. Plan today’s tasks\n2. View yesterday’s tasks\n3. Change my focus\n\n(Reply with the number)`, { parse_mode: 'Markdown' });
  }

});

const { handleSubscribeCommand, handleSubscriptionCallback } = require("./subscriptionHandlers");

bot.onText(/\/subscribe/, (msg) => {
  handleSubscribeCommand(bot, msg);
});

bot.on("callback_query", (callbackQuery) => {
  handleSubscriptionCallback(bot, callbackQuery);
});

module.exports = bot;
