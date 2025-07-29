require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const cron = require('node-cron');
const handleMessage = require('./handlers/messageHandlers');
const { handleSubscribeCommand, handleSubscriptionCallback } = require("./handlers/subscriptionHandlers");
const { findOrCreateUser } = require('./controllers/userController'); // Make sure this exists
const User = require('./models/user'); // Needed for cron jobs
const app = express();
app.use(express.json());
const webhookRoutes = require('./routes/paystackWebhook'); // Import webhook routes
app.use('/api', webhookRoutes); // Mount webhook routes
// ✅ Replace polling with webhook-compatible bot (do NOT set port here)
const bot = new TelegramBot(process.env.BOT_TOKEN);

// ✅ MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// ✅ Start cron reminders
const startDailyReminders = require('./utils/cronJobs');
startDailyReminders(bot);

// 🕗 8 PM daily check-in reminder
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

// 🌙 Reset check-in flags at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    await User.updateMany({}, { hasCheckedInToday: false });
    console.log('🔄 Reset all check-in flags at midnight');
  } catch (err) {
    console.error('❌ Error resetting check-in flags:', err);
  }
});

// ✅ Telegram Webhook Setup
const URL = process.env.RENDER_EXTERNAL_URL;
bot.setWebHook(`${URL}/bot${process.env.BOT_TOKEN}`);

// ✅ Express Webhook Handler
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  console.log('🔔 Received webhook update:', req.body);
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 📩 Handle /start messages
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();

  const user = await findOrCreateUser(telegramId);

  if (user.stage !== 'completed_onboarding') {
    if (text === '1') {
     user.stage = 'awaiting_daily_tasks';
     await user.save();
     return bot.sendMessage(chatId, 'Great! What tasks do you want to focus on today? (Separate them with commas)');
    }

    if (text === '2') {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
     const history = user.history?.find(h => h.date === yesterday);
     if (history) {
       return bot.sendMessage(chatId,
       `📅 Yesterday's Tasks:\n` +
       history.tasks.map(t => `- ${t}`).join('\n') +
       `\n\nChecked in: ${history.checkedIn ? '✅' : '❌'}\nFocus: ${history.focus}`);
     } 
     else {
        return bot.sendMessage(chatId, '❌ No tasks found for yesterday.');
      } 
    }

     if (text === '3') {
       user.stage = 'awaiting_focus';
       await user.save();
       return bot.sendMessage(chatId, 'What would you like your new focus to be?');
      }
  }
  await bot.sendMessage(chatId, 'Let’s get you started again...');
  return handleMessage(bot, msg, true);
  //else {
   // return bot.sendMessage(chatId, `👋 Welcome back, *${user.name}*!\nYour focus is still *${user.focus}*.\n\nWhat would you like to do today?\n\n1. Plan today’s tasks\n2. View yesterday’s tasks\n3. Change my focus\n\n(Reply with the number)`, { parse_mode: 'Markdown' });
 // }
});

bot.onText(/\/subscribe/, (msg) => {
  handleSubscribeCommand(bot, msg);
});

bot.on("callback_query", (callbackQuery) => {
  handleSubscriptionCallback(bot, callbackQuery);
});

// ✅ Start Express server (REQUIRED for Render)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});

module.exports = app;
