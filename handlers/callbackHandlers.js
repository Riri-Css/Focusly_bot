// File: src/handlers/callbackHandlers.js - CORRECTED
const User = require('../models/user');
const {
  getChecklistById,
  updateChecklist,
  submitCheckin,
  getOrCreateUser,
} = require('../controllers/userController');
const {
  createChecklistKeyboard,
  createChecklistMessage,
  createFinalCheckinMessage,
  sendTelegramMessage,
} = require('./messageHandlers');
const { generatePaystackLink } = require('../utils/paystackUtils');
const { getPlanDetails } = require('../utils/subscriptionUtils');
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

// registerTestButtonCommand function...
function registerTestButtonCommand(bot) {
  bot.onText(/\/testbutton/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, 'Click a button below:', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Test Callback', callback_data: 'test_callback' }
          ]
        ]
      }
    });
  });
}


/**
 * Handles incoming callback queries from inline keyboards.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object.
 */
async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  await bot.answerCallbackQuery(callbackQuery.id);

  try {
    const telegramId = chatId.toString();
    const user = await getOrCreateUser(telegramId);
    if (!user) {
      return sendTelegramMessage(bot, chatId, 'Error: Could not retrieve or create user.');
    }

    let parsedData;
    try {
        parsedData = JSON.parse(data);
    } catch (e) {
        parsedData = null;
    }
    
    if (parsedData && parsedData.action === 'subscribe') {
        const plan = parsedData.plan;
        
        const planDetails = getPlanDetails(plan);

        if (!planDetails) {
            return sendTelegramMessage(bot, chatId, `Sorry, the price for the ${plan} plan is not available.`);
        }
        
        const amount = planDetails.price;
        const amountInKobo = planDetails.priceInKobo;

        const paymentUrl = await generatePaystackLink(user, amountInKobo, plan);

        if (paymentUrl) {
            const keyboard = {
                inline_keyboard: [
                    [{ text: `Proceed to Pay ₦${amount}`, url: paymentUrl }]
                ]
            };
            await sendTelegramMessage(bot, chatId, 
                `Click the button below to complete your payment for the **${plan}** plan:`, 
                { reply_markup: keyboard }
            );
        } else {
            await sendTelegramMessage(bot, chatId, 'An error occurred while preparing your payment link. Please try again.');
        }
        return;
    }
    
    // Existing checklist handling logic
    const [action, checklistId, taskIndexStr] = data.split('|');
    const taskIndex = taskIndexStr ? parseInt(taskIndexStr, 10) : null;

    if (action === 'test_callback') {
        console.log('✅ Test callback triggered!');
        await sendTelegramMessage(bot, chatId, 'You clicked the test button!');
        return;
    }

    const checklist = await getChecklistById(user.telegramId, checklistId);
    if (!checklist) {
      console.error(`❌ Checklist ID ${checklistId} not found during callback.`);
      await sendTelegramMessage(bot, chatId, "Sorry, I couldn't find that checklist. It may have been replaced by a new one.");
      return;
    }

    switch (action) {
      case 'toggle_task':
        if (taskIndex === null || isNaN(taskIndex)) {
          await bot.answerCallbackQuery('Invalid task index.');
          return;
        }
        const taskToToggle = checklist.tasks[taskIndex];
        if (taskToToggle) {
          taskToToggle.completed = !taskToToggle.completed;
          await updateChecklist(user.telegramId, checklist);

          const keyboard = createChecklistKeyboard(checklist);
          const messageText =
            `Good morning! Here is your daily checklist to push you towards your goal:\n\n` +
            `**Weekly Goal:** ${user.goalMemory.text}\n\n` +
            createChecklistMessage(checklist);

          await bot.editMessageText(messageText, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard,
          });
        } else {
          await bot.answerCallbackQuery('Task not found.');
        }
        break;

      case 'submit_checkin':
        if (checklist.checkedIn) {
          await bot.answerCallbackQuery('You have already submitted this check-in.');
          return;
        }

        checklist.checkedIn = true;
        await updateChecklist(user.telegramId, checklist);

        const submittedUser = await submitCheckin(user, checklistId);
        const finalMessage = createFinalCheckinMessage(submittedUser, checklist);

        await bot.editMessageText(finalMessage, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [] },
        });
        break;

      default:
        console.warn(`Unknown callback action: ${action}`);
        await sendTelegramMessage(bot, chatId, 'An unknown action was requested.');
        break;
    }
  } catch (error) {
    console.error('❌ Error handling callback query:', error);
    await sendTelegramMessage(bot, chatId, 'An error occurred while processing your request.');
  }
}

module.exports = {
  handleCallbackQuery,
  registerTestButtonCommand,
};