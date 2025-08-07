require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const { handleMessage } = require('../handlers/messageHandlers');
const webhookRoutes = require('../utils/webhook');
const paystackWebhook = require('../routes/paystackWebhook');
const moment = require('moment-timezone');
const { getUserByTelegramId, updateUserField } = require('../controllers/userController');
const { createChecklistMessage, createChecklistKeyboard, createFinalCheckinMessage } = require('../handlers/messageHandlers');
const { generatePaystackLink } = require('../utils/paystackUtils'); // 🆕 Import the new function

const app = express();

const bot = require('./botInstance'); 
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

mongoose.connect(process.env.MONGODB_URI, {
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ MongoDB connected');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

bot.on('message', (msg) => {
  handleMessage(bot, msg);
});

bot.on('callback_query', async (callbackQuery) => {
    // 🆕 Add logging here to see what data is received
    console.log('Received callback query:', callbackQuery.data);
    
    const data = callbackQuery.data;
    const [action, planOrTaskId] = data.split('_'); 
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    const TIMEZONE = 'Africa/Lagos';

    try {
      // 🆕 Fetch the user document FIRST
      let user = await getUserByTelegramId(userId);

      // 🆕 Check if a user was found
      if (!user) {
        console.error(`❌ User not found for callback query: ${userId}`);
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong. Please start a new conversation." });
        return;
      }

      // 🆕 Handle Subscription Buttons
      if (action === 'subscribe') {
        const plan = planOrTaskId;
        const amount = plan === 'premium' ? 1000 : 500;

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
        return;
      }

      // --- Existing Checklist Logic ---
      const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
      const todayChecklist = user.checklists.find(c => moment(c.date).tz(TIMEZONE).format('YYYY-MM-DD') === today);

      if (!todayChecklist) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: "There's no checklist to update!" });
        return;
      }

      if (action === 'toggle') {
        const taskToUpdate = todayChecklist.tasks.find(task => task._id.toString() === planOrTaskId);
        if (taskToUpdate) {
          taskToUpdate.completed = !taskToUpdate.completed;
          await user.save();

          const updatedMessage = createChecklistMessage(todayChecklist);
          await bot.editMessageText(updatedMessage, {
            chat_id: chatId,
            message_id: callbackQuery.message.message_id,
            parse_mode: 'Markdown',
            reply_markup: createChecklistKeyboard(todayChecklist)
          });
          await bot.answerCallbackQuery(callbackQuery.id);
        }
      } else if (action === 'submit') {
        const completedTasksCount = todayChecklist.tasks.filter(task => task.completed).length;
        const totalTasksCount = todayChecklist.tasks.length;

        todayChecklist.checkedIn = true;
        todayChecklist.progressReport = `Checked in with ${completedTasksCount} out of ${totalTasksCount} tasks completed.`;
        await user.save(); 

        await updateUserField(user.telegramId, { hasCheckedInTonight: true });

        const finalMessage = createFinalCheckinMessage(user, todayChecklist);
        await bot.editMessageText(finalMessage, {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          parse_mode: 'Markdown'
        });
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Check-in submitted!" });
      }
    } catch (error) {
        console.error("❌ Error handling callback query:", error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});