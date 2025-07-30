require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const { handleMessage } = require('./handlers/messageHandlers');
const webhookRoutes = require('./utils/webhook');
const paystackWebhook = require('./routes/paystackWebhook');

const app = express();

// ✅ Create the bot before setting webhook
const bot = new TelegramBot(process.env.BOT_TOKEN);
bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/webhook`);

// Middleware
app.use(bodyParser.json());

// Telegram webhook route
app.post(`/webhook`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Webhook routes (e.g. Paystack)
app.use('/paystack/webhook', paystackWebhook);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Message handler
bot.on('message', (msg) => {
  handleMessage(bot, msg);
});

// Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
