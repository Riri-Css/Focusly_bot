require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');

const handleMessage = require('./handlers/messageHandlers');
const setupCronJobs = require('./utils/cronJobs');
const webhookRoutes = require('./utils/webhook');
const paystackWebhook = require('./routes/paystackWebhook');
const { handleCareerCommand } = require('./commandHandlers/careerHandlers');

const app = express();

// ✅ Setup Express Middleware
app.use(bodyParser.json());
app.use('/webhook', webhookRoutes); // Telegram webhook
app.use('/paystack/webhook', paystackWebhook); // Paystack webhook

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');

  // ✅ Initialize Telegram bot WITHOUT polling
  const bot = new TelegramBot(process.env.BOT_TOKEN);
  bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/webhook`);

  // ✅ Listen for incoming messages via webhook
  app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });

  // ✅ Message handlers
  bot.on('message', (msg) => handleMessage(bot, msg));

  // ✅ Handle /career command
  bot.onText(/\/career/, (msg) => handleCareerCommand(bot, msg));

  // ✅ Setup daily cron jobs
  setupCronJobs(bot);
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// ✅ Start Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});
