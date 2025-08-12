// File: src/handlers/callbackHandlers.js
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
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

/**
 * Register /testbutton command here to send test inline keyboard
 * This should NOT be inside handleCallbackQuery, but at the module root.
 */
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

    // Split callback data on '|'
    const [action, checklistId, taskIndexStr] = data.split('|');
    const taskIndex = taskIndexStr ? parseInt(taskIndexStr, 10) : null;

    // Handle test_callback separately (no checklistId or taskIndex needed)
    if (action === 'test_callback') {
      console.log('✅ Test callback triggered!');
      await sendTelegramMessage(bot, chatId, 'You clicked the test button!');
      return;
    }

    // For other actions, get checklist first
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
