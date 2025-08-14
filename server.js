// server.js - Updated to use secure paystackWebhook with raw body verification

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const paystackWebhook = require('./routes/paystackWebhook'); // ✅ using the merged robust file
const messageHandlers = require('./handlers/messageHandlers');
const callbackHandlers = require('./handlers/callbackHandlers');
const subscriptionRoutes = require('./handlers/subscriptionHandlers');
const { startDailyJobs } = require('./utils/cronJobs');
const { scheduleCustomReminders } = require('./utils/reminderScheduler');

const app = express();

const url = process.env.RENDER_EXTERNAL_URL;
const port = process.env.PORT || 3000;

// === Telegram Bot Setup ===
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });
bot.setWebHook(`${url}/bot${process.env.BOT_TOKEN}`);

// === Paystack Webhook route FIRST (with raw body) ===
// ⚠️ This must be BEFORE bodyParser.json() so signature verification works
app.use('/paystack/webhook', paystackWebhook);

// === Body parser for all other routes ===
app.use(bodyParser.json());

// === Telegram Webhook Endpoint ===
app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {
  try {
    const update = req.body;

    if (update.message) {
      console.log("📩 Incoming message:", update.message.text);
      await messageHandlers.handleMessage(bot, update.message);
    } else if (update.callback_query) {
      console.log("🔘 Incoming callback query:", update.callback_query.data);
      await callbackHandlers.handleCallbackQuery(bot, update.callback_query);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Error in webhook handler:", err);
    res.sendStatus(500);
  }
});

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

// === Start Server ===
app.listen(port, () => {
  console.log(`🌐 Server running on port ${port}`);
});

module.exports = { bot };
