// File: src/handlers/callbackHandlers.js
// This version handles all button callback queries, including subscription buttons.
const User = require('../models/user');
const { createChecklistMessage, createChecklistKeyboard, sendTelegramMessage } = require('./messageHandlers');
const { getUserByTelegramId } = require('../controllers/userController');
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

    console.log('--- Debugging Callback Query ---');
    console.log('Received raw callback data:', data);

    
    try {
        const parsedData = JSON.parse(data);
        console.log('✅ Parsed callback query data:', parsedData);

        switch (parsedData.action) {
            case 'toggle_task':
                await handleTaskToggle(bot, callbackQuery, parsedData);
                break;
            case 'submit_checkin':
                await handleSubmitCheckin(bot, callbackQuery, parsedData);
                break;
            case 'subscribe':
                await handleSubscription(bot, callbackQuery, parsedData);
                break;
            default:
                await bot.answerCallbackQuery(callbackId, { text: "Unknown action." });
                break;
        }
    } catch (error) {
        console.error('❌ Error parsing callback data or handling action:', error);
        await bot.answerCallbackQuery(callbackId, { text: "An error occurred. Please try again." });
    }
}

/**
 * Handles toggling the completion status of a checklist task.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 * @param {object} parsedData - The already parsed data from the callback query.
 */
async function handleTaskToggle(bot, callbackQuery, parsedData) {
    const { from, message, id: callbackId } = callbackQuery;
    const telegramId = from.id;
    const { checklistId, taskId } = parsedData;

    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            await bot.answerCallbackQuery(callbackId, { text: "User not found. Please start over." });
            return;
        }

        const checklist = user.checklists.id(checklistId);
        if (!checklist) {
            await bot.answerCallbackQuery(callbackId, { text: "Checklist not found. Please try again." });
            return;
        }

        const task = checklist.tasks.id(taskId);
        if (!task) {
            await bot.answerCallbackQuery(callbackId, { text: "Task not found. Please try again." });
            return;
        }

        task.completed = !task.completed;

        await user.save();

        const updatedKeyboard = createChecklistKeyboard(checklist);
        const updatedMessageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` + createChecklistMessage(checklist);
        
        await bot.editMessageText(updatedMessageText, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: updatedKeyboard,
            parse_mode: 'Markdown'
        });

        console.log(`✅ User ${telegramId} toggled task: ${task.text}`);
        await bot.answerCallbackQuery(callbackId, { text: task.completed ? "Task completed! ✅" : "Task marked as incomplete." });

    } catch (error) {
        console.error('❌ Error handling task toggle:', error);
        await bot.answerCallbackQuery(callbackId, { text: "An error occurred while toggling the task." });
    }
}

/**
 * Handles the final submission of a user's checklist.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 * @param {object} parsedData - The already parsed data from the callback query.
 */
async function handleSubmitCheckin(bot, callbackQuery, parsedData) {
    const { from, message, id: callbackId } = callbackQuery;
    const telegramId = from.id;
    const { checklistId } = parsedData;

    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            await bot.answerCallbackQuery(callbackId, { text: "User not found. Please start over." });
            return;
        }

        const checklist = user.checklists.id(checklistId);
        if (!checklist) {
            await bot.answerCallbackQuery(callbackId, { text: "Checklist not found. Please try again." });
            return;
        }

        checklist.checkedIn = true;
        
        const completedTasks = checklist.tasks.filter(task => task.completed).length;
        const totalTasks = checklist.tasks.length;
        
        let completionMessage;
        if (completedTasks === totalTasks) {
            completionMessage = `**Amazing! You completed all your tasks today!** 🎉 Keep up this incredible momentum! Your consistency will lead to great results.`;
        } else if (completedTasks > 0) {
            completionMessage = `**Great job!** You completed ${completedTasks} out of ${totalTasks} tasks today. Every step forward counts! Let's aim to knock out the rest tomorrow. 💪`;
        } else {
            completionMessage = `**That's okay!** You can't win them all, but every day is a new chance to try. Let's make tomorrow a day of progress!`;
        }

        await sendTelegramMessage(bot, telegramId, `✅ **Check-in Successful!**\n\n${completionMessage}\n\nI've saved your progress for today. Now, rest well and prepare for an even better day tomorrow!`);

        await user.save();
        
        await bot.answerCallbackQuery(callbackId, { text: "Check-in successful! Your progress is saved." });
        
        await bot.deleteMessage(message.chat.id, message.message_id);

        console.log(`✅ User ${telegramId} submitted check-in for checklist ${checklistId}.`);

    } catch (error) {
        console.error('❌ Error handling submit checkin:', error);
        await bot.answerCallbackQuery(callbackId, { text: "An error occurred while submitting the check-in." });
    }
}

/**
 * Handles the subscription button callback.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 * @param {object} parsedData - The already parsed data from the callback query.
 */
async function handleSubscription(bot, callbackQuery, parsedData) {
    const { from, message, id: callbackId } = callbackQuery;
    const userId = from.id;
    const chatId = message.chat.id;
    
    try {
        const { plan } = parsedData;
        const amount = plan === 'premium' ? 1000 : 500;
        const user = await getUserByTelegramId(userId);

        if (!user) {
            await bot.answerCallbackQuery(callbackId, { text: "User not found. Please start over." });
            return;
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
        
        await bot.answerCallbackQuery(callbackId);
        
    } catch (error) {
        console.error("❌ Error handling subscription callback:", error);
        await bot.answerCallbackQuery(callbackId, { text: "Something went wrong while generating the payment link." });
    }
}

module.exports = {
    handleCallbackQuery,
    handleTaskToggle,
    handleSubmitCheckin,
    handleSubscription
};
