require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');

const messageHandlers = require('./handlers/messageHandlers');
const { startDailyJobs } = require('./utils/cronJobs');
const { scheduleCustomReminders } = require('./utils/reminderScheduler');
const subscriptionRoutes = require('./handlers/subscriptionHandlers');
const webhookHandler = require('./utils/webhook');

const app = express();
app.use(bodyParser.json());

// Setup Telegram Bot
const bot = new TelegramBot(process.env.BOT_TOKEN);
app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Webhook route for Paystack
app.post('/webhook', webhookHandler);

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Start scheduled jobs
  startDailyJobs(bot);
  scheduleCustomReminders(bot);
});

// Telegram message handler
bot.on('message', (msg) => {
  console.log("User sent a message:", msg.text);
  messageHandlers(bot, msg);
});
