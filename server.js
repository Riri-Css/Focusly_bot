// bot.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const messageHandlers = require('./handlers/messageHandlers');
const { startDailyJobs } = require('./utils/cronJobs');
const { scheduleCustomReminders } = require('./utils/reminderScheduler');

// 🔁 Initialize bot in webhook mode
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  webHook: {
    port: process.env.BOT_PORT || 3000,
  }
});

// Set Telegram webhook (do this ONCE after deployment)
// You can comment this out later if needed
const webhookUrl = `${process.env.BASE_URL}/webhook`;
bot.setWebHook(webhookUrl);

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    startDailyJobs(bot);
    scheduleCustomReminders(bot);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
})();

// Incoming Telegram messages (via webhook)
bot.on('message', async (msg) => {
  try {
    console.log("User sent a message:", msg.text);
    await messageHandlers.handleMessage(bot, msg);
  } catch (err) {
    console.error("❌ Error handling message:", err);
  }
});

module.exports = bot;
