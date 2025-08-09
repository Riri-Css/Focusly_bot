// File: index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const { handleMessage, createChecklistMessage, createChecklistKeyboard, createFinalCheckinMessage } = require('./handlers/messageHandlers');
const webhookRoutes = require('./utils/webhook');
const paystackWebhook = require('./routes/paystackWebhook');
const moment = require('moment-timezone');
const { getUserByTelegramId, updateUserField } = require('./controllers/userController');
const { generatePaystackLink } = require('./utils/paystackUtils');
const { handleTaskToggle, handleSubmitCheckin } = require('./handlers/callbackHandlers');

const app = express();
const bot = require('./botInstance');

// Webhook setup
bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/webhook`);

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.post(`/webhook`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.use('/paystack/webhook', paystackWebhook);

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// Main message handler
bot.on('message', (msg) => {
  handleMessage(bot, msg);
});

// Main callback query handler
bot.on('callback_query', async (callbackQuery) => {
  console.log('🔔 Callback query received at the top level.');
  
  const { from, data } = callbackQuery;
  const userId = from.id;
  const chatId = callbackQuery.message.chat.id;

  try {
    // 🆕 Parse the data ONCE here
    const parsedData = JSON.parse(data);
    const { action } = parsedData;

    // Route to the appropriate handler based on the button action, passing the parsed data
    if (action === 'toggle_task') {
      await handleTaskToggle(bot, callbackQuery, parsedData);
    } else if (action === 'submit_checkin') {
      await handleSubmitCheckin(bot, callbackQuery, parsedData);
    } else if (action === 'subscribe') {
      const plan = parsedData.plan;
      const amount = plan === 'premium' ? 1000 : 500;
      const user = await getUserByTelegramId(userId);

      if (!user) {
        return bot.answerCallbackQuery(callbackQuery.id, { text: "User not found. Please start over." });
      }

      const paymentLink = await generatePaystackLink(user, amount, plan);

      if (paymentLink) {
        const message = `Please click the button below to subscribe to the *${plan} plan* for $${amount/100}.\n\n*Note: If you've already paid, your subscription will be activated automatically. If it isn't, please contact support.*`;
        await bot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Click to Pay', url: paymentLink }],
            ],
          },
          parse_mode: 'Markdown',
        });
      } else {
        await bot.sendMessage(chatId, "❌ I couldn't generate a payment link at the moment. Please try again later.");
      }
      await bot.answerCallbackQuery(callbackQuery.id);
    } else {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Unknown action." });
    }
  } catch (error) {
    console.error("❌ Error handling callback query:", error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong." });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
