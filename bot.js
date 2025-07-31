require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');

const messageHandlers = require('./handlers/messageHandlers');
const { startDailyJobs } = require('./utils/cronJobs');
const { scheduleCustomReminders } = require('./utils/reminderScheduler');

const bot = new TelegramBot(process.env.BOT_TOKEN);

const app = express();
app.use(bodyParser.json());

app.post('/', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server listening on port ${PORT}`);

  const url = `${process.env.BASE_URL}`;
  await bot.setWebHook(`${url}/`);
  console.log(`✅ Webhook set to ${url}/`);
});

// DB + jobs
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    startDailyJobs(bot);
    scheduleCustomReminders(bot);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
})();
