require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const paystackWebhook = require('./routes/paystackWebhook');
const handleMessage = require('./handlers/messageHandlers');
const subscriptionRoutes = require('./handlers/subscriptionHandlers');
const { startDailyJobs } = require('./utils/cronJobs');
const { scheduleCustomReminders } = require('./utils/reminderScheduler');

// === Initialize Express App ===
const app = express();
app.use(bodyParser.json());

// === Telegram Bot Setup (Webhook Mode) ===
const bot = new TelegramBot(process.env.BOT_TOKEN);
const url = process.env.RENDER_EXTERNAL_URL;
const port = process.env.PORT || 3000;

// Set Telegram webhook to Render URL
bot.setWebHook(`${url}/bot${process.env.BOT_TOKEN}`);

// Handle Telegram updates via webhook
app.post(`/bot${process.env.BOT_TOKEN}`, async (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Handle incoming messages
bot.on('message', async (msg) => {
  try {
    console.log("📩 Incoming message:", msg.text);
    await handleMessage(bot, msg);
  } catch (err) {
    console.error("❌ Error handling message:", err);
  }
});

// === Paystack Webhook ===
app.use('/paystack/webhook', paystackWebhook);

// === Root route for basic health check ===
app.get('/', (req, res) => {
  res.send('🚀 Focusly Telegram bot server is live!');
});

// === MongoDB Connection and Cron Jobs ===
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    startDailyJobs(bot);
    scheduleCustomReminders(bot);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
  }
})();

// === Start the Express Server ===
app.listen(port, () => {
  console.log(`🌐 Express server running on port ${port}`);
});
