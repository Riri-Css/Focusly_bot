require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const { handleMessage } = require('./handlers/messageHandlers');
const webhookRoutes = require('./utils/webhook'); // We’ll create this file soon

//const messageHandlers = require('./handlers/messageHandlers');
//const setupCronJobs = require('./utils/cronJobs');
//const { handleCareerCommand } = require('./commandHandlers/careerHandlers');
//const paystackWebhook = require('./routes/paystackWebhook');


const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
messageHandlers(bot); // ✅ Initialize smart message handlers

// ✅ Handle /career command
bot.onText(/\/career/, (msg) => {
  handleCareerCommand(bot, msg);
});

// ✅ Connect to MongoDB first
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected');

  // Telegram message listener
bot.on('message', (msg) => {
  handleMessage(bot, msg); // Call your bot logic from here
});

// Webhook setup
app.use(bodyParser.json());
app.use('/webhook', webhookRoutes);


  // ✅ Start cron jobs AFTER successful DB connection
  setupCronJobs(bot);
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// ✅ Express server for Paystack webhooks
const app = express();
app.use(express.json()); // Required to parse incoming JSON from Paystack
app.use('/paystack/webhook', paystackWebhook);

// ✅ Start Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
});

const webhookHandler = require('./routes/paystackWebhook');
app.use(webhookHandler); // after app is defined

const express = require('express');

// Other requires like mongoose, TelegramBot, etc.
const webhookRoutes = require('./utils/webhook'); // adjust if in subfolder

app.use('/', webhookRoutes);

// Your Telegram bot setup
