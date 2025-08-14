// server.js - Updated to fix EADDRINUSE error and handle callback queries

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const paystackWebhook = require('./routes/paystackWebhook');
const messageHandlers = require('./handlers/messageHandlers');
const callbackHandlers = require('./handlers/callbackHandlers'); // <-- IMPORTED
const subscriptionRoutes = require('./handlers/subscriptionHandlers');
const { startDailyJobs } = require('./utils/cronJobs');
const { scheduleCustomReminders } = require('./utils/reminderScheduler');

const app = express();
app.use(bodyParser.json());

const url = process.env.RENDER_EXTERNAL_URL;
const port = process.env.PORT || 3000;

// === Telegram Bot Setup (Webhook Mode Only) ===
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: false
});

// Set Webhook (secure endpoint for Telegram)
bot.setWebHook(`${url}/bot${process.env.BOT_TOKEN}`);

// Webhook endpoint
app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {
  try {
    const update = req.body; // <-- Get the entire update object

    if (update.message) { // <-- Check for a message
      console.log("📩 Incoming message:", update.message.text);
      await messageHandlers.handleMessage(bot, update.message);
    } else if (update.callback_query) { // <-- NEW: Check for a callback query
      console.log("🔘 Incoming callback query:", update.callback_query.data);
      await callbackHandlers.handleCallbackQuery(bot, update.callback_query);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.sendStatus(500);
  }
});

// === Paystack Webhook ===
app.use('/paystack/webhook', paystackWebhook);

// === Health check ===
app.get('/', (req, res) => {
  res.send('🚀 Focusly bot server is running');
});

// === MongoDB and Cron Setup ===
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

// === Start Express Server ===
app.listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
});

module.exports = { bot }; // Export bot for use in cron jobs