// File: src/handlers/callbackHandlers.js
// This version handles all button callback queries, including subscription buttons.
const User = require('../models/user');
const {
    createChecklistMessage,
    createChecklistKeyboard,
    createFinalCheckinMessage,
    sendTelegramMessage
} = require('./messageHandlers');
const { generatePaystackLink } = require('../utils/paystackUtils');
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

/**
 * Main handler for all incoming callback queries.
 * It parses the callback data and routes it to the correct function.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 */
async function handleCallbackQuery(bot, callbackQuery) {
    const { data, id: callbackId } = callbackQuery;
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;

    console.log('--- Debugging Callback Query ---');
    console.log(`Received raw callback data from user ${userId}:`, data);

    // Acknowledge the callback immediately to prevent a timeout.
    await bot.answerCallbackQuery(callbackId).catch(err => {

        bot.on('callback_query', async (callbackQuery) => {
  console.log("=== CALLBACK QUERY RECEIVED ===");
  console.log(callbackQuery);

  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (callbackQuery.data === 'test_callback') {
  await sendTelegramMessage(bot, callbackQuery.message.chat.id, "Callback works ✅");
  await bot.answerCallbackQuery(callbackQuery.id); // acknowledge callback
  return;
}

  if (data === "test_callback") {
    await bot.sendMessage(chatId, "Callback works ✅");
  }
});

        console.error('❌ Failed to answer callback query immediately:', err);
    });

    try {
        // Parse the compact, pipe-separated callback data
        const [action, ...params] = data.split('|');

        switch (action) {
            case 'toggle_task': {
                const [checklistIdToggle, taskIndexStr] = params;
                const taskIndex = parseInt(taskIndexStr, 10);
                const userToggle = await User.findOne({ telegramId: userId });

                if (!userToggle) {
                    await sendTelegramMessage(bot, chatId, "User not found. Please start over.");
                    return;
                }

                const checklistToggle = userToggle.checklists.find(c => c.id === checklistIdToggle);
                if (!checklistToggle) {
                    await sendTelegramMessage(bot, chatId, "Checklist not found. Please try again.");
                    return;
                }

                const taskToggle = checklistToggle.tasks[taskIndex];
                if (!taskToggle) {
                    await sendTelegramMessage(bot, chatId, "Task not found. Please try again.");
                    return;
                }

                taskToggle.completed = !taskToggle.completed;
                await userToggle.save();

                const keyboard = createChecklistKeyboard(checklistToggle);
                const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${userToggle.goalMemory.text}\n\n` + createChecklistMessage(checklistToggle);

                await bot.editMessageText(messageText, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
                console.log(`✅ User ${userId} toggled task index: ${taskIndex}`);
                break;
            }

            case 'submit_checkin': {
                const [checklistIdSubmit] = params;
                const userSubmit = await User.findOne({ telegramId: userId });

                if (!userSubmit) {
                    await sendTelegramMessage(bot, chatId, "User not found. Please start over.");
                    return;
                }

                const checklistSubmit = userSubmit.checklists.find(c => c.id === checklistIdSubmit);
                if (!checklistSubmit) {
                    await sendTelegramMessage(bot, chatId, "Checklist not found. Please try again.");
                    return;
                }

                checklistSubmit.checkedIn = true;
                await userSubmit.save();

                const finalMessage = createFinalCheckinMessage(userSubmit, checklistSubmit);

                await bot.editMessageText(finalMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [] }
                });
                console.log(`✅ User ${userId} submitted check-in for checklist ${checklistIdSubmit}.`);
                break;
            }

            case 'subscribe': {
                const [plan] = params;
                await handleSubscription(bot, callbackQuery, plan);
                break;
            }

            default:
                console.error(`❌ Unknown action received: ${action}`);
                await sendTelegramMessage(bot, chatId, "I don't know how to handle that action.");
                break;
        }

    } catch (error) {
        console.error('❌ A fatal error occurred while handling a callback query:', error);
        await sendTelegramMessage(bot, chatId, "An internal error occurred. Please try again.");
    }
}

/**
 * Handles the subscription button callback.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 * @param {string} plan - The subscription plan from the callback data.
 */
async function handleSubscription(bot, callbackQuery, plan) {
    const { from, message } = callbackQuery;
    const userId = from.id;
    const chatId = message.chat.id;

    if (!plan) {
        console.error('❌ Incomplete callback data for subscription. Missing plan.');
        await sendTelegramMessage(bot, chatId, "An error occurred. The plan information was incomplete. Please try again.");
        return;
    }

    try {
        // Correct subscription amounts in kobo for Paystack (₦1,000 and ₦1,500)
        const amount = plan === 'premium' ? 150000 : 100000;

        const user = await User.findOne({ telegramId: userId });

        if (!user) {
            await sendTelegramMessage(bot, chatId, "User not found. Please start over.");
            return;
        }

        const paymentLink = await generatePaystackLink(user, amount, plan);

        if (paymentLink) {
            const message = `Please click the button below to subscribe to the *${plan} plan* for ₦${amount / 100}.\n\n*Note: If you've already paid, your subscription will be activated automatically. If it isn't, please contact support.*`;
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

    } catch (error) {
        console.error("❌ Error handling subscription callback:", error);
        await sendTelegramMessage(bot, chatId, "Something went wrong while generating the payment link.");
    }
}

module.exports = {
    handleCallbackQuery,
    handleSubscription
};
