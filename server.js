// server.js - Updated to fix EADDRINUSE error

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const paystackWebhook = require('./routes/paystackWebhook');
const messageHandlers = require('./handlers/messageHandlers');
const subscriptionRoutes = require('./handlers/subscriptionHandlers');
const { startDailyJobs } = require('./utils/cronJobs');
const { scheduleCustomReminders } = require('./utils/reminderScheduler');

const app = express();
app.use(bodyParser.json());

const url = process.env.RENDER_EXTERNAL_URL;
const port = process.env.PORT || 3000;

// === Telegram Bot Setup (Webhook Mode Only) ===
// We are removing the { webHook: { port } } option.
// The Express app will handle all incoming traffic on the port,
// so the bot library does not need to create its own server.
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: false
});

// Set Webhook (secure endpoint for Telegram)
bot.setWebHook(`${url}/bot${process.env.BOT_TOKEN}`);

// Webhook endpoint
app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {
  try {
    const message = req.body.message;
    if (message) {
      console.log("📩 Incoming message:", message.text);
      await messageHandlers.handleMessage(bot, message);
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
