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
    const userId = callbackQuery.from.id;

    console.log('--- Debugging Callback Query ---');
    console.log(`Received raw callback data from user ${userId}:`, data);

    // Acknowledge the callback immediately to prevent a timeout.
    await bot.answerCallbackQuery(callbackId).catch(err => {
        console.error('❌ Failed to answer callback query immediately:', err);
    });

    let parsedData;
    try {
        // Attempt to parse the data as JSON within its own try-catch block
        parsedData = JSON.parse(data);
        console.log('✅ Successfully parsed callback query data:', parsedData);
    } catch (parseError) {
        console.error('❌ Failed to parse callback data as JSON:', data, parseError);
        await sendTelegramMessage(bot, userId, "An error occurred with the button data. Please try again or contact support.");
        return; // Exit the function if parsing fails
    }

    // Now, with successfully parsed data, handle the rest of the logic
    try {
        if (!parsedData.action) {
            console.error('❌ Parsed callback data is missing an "action" field.');
            await sendTelegramMessage(bot, userId, "An internal error occurred. Please try again.");
            return;
        }

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
                console.error(`❌ Unknown action received: ${parsedData.action}`);
                await sendTelegramMessage(bot, userId, "I don't know how to handle that action.");
                break;
        }
    } catch (error) {
        console.error('❌ A fatal error occurred while handling a callback query:', error);
        await sendTelegramMessage(bot, userId, "An internal error occurred. Please try again.");
    }
}

/**
 * Handles toggling the completion status of a checklist task.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 * @param {object} parsedData - The already parsed data from the callback query.
 */
async function handleTaskToggle(bot, callbackQuery, parsedData) {
    const { from, message } = callbackQuery;
    const telegramId = from.id;

    // ✅ FIX: Add a check to ensure both checklistId and taskId exist.
    const { checklistId, taskId } = parsedData;
    if (!checklistId || !taskId) {
        console.error('❌ Incomplete callback data for task toggle. Missing checklistId or taskId.');
        await sendTelegramMessage(bot, telegramId, "An error occurred. The task information was incomplete. Please try again.");
        return;
    }

    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            await sendTelegramMessage(bot, telegramId, "User not found. Please start over.");
            return;
        }

        const checklist = user.checklists.find(c => c.id === checklistId);
        if (!checklist) {
            await sendTelegramMessage(bot, telegramId, "Checklist not found. Please try again.");
            return;
        }

        const task = checklist.tasks.find(t => t.id === taskId);
        if (!task) {
            await sendTelegramMessage(bot, telegramId, "Task not found. Please try again.");
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

    } catch (error) {
        console.error('❌ Error handling task toggle:', error);
        await sendTelegramMessage(bot, telegramId, "An error occurred while toggling the task.");
    }
}

/**
 * Handles the final submission of a user's checklist.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 * @param {object} parsedData - The already parsed data from the callback query.
 */
async function handleSubmitCheckin(bot, callbackQuery, parsedData) {
    const { from, message } = callbackQuery;
    const telegramId = from.id;

    // ✅ FIX: Add a check to ensure checklistId exists.
    const { checklistId } = parsedData;
    if (!checklistId) {
        console.error('❌ Incomplete callback data for check-in. Missing checklistId.');
        await sendTelegramMessage(bot, telegramId, "An error occurred. The check-in information was incomplete. Please try again.");
        return;
    }

    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            await sendTelegramMessage(bot, telegramId, "User not found. Please start over.");
            return;
        }

        const checklist = user.checklists.find(c => c.id === checklistId);
        if (!checklist) {
            await sendTelegramMessage(bot, telegramId, "Checklist not found. Please try again.");
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
        
        await bot.deleteMessage(message.chat.id, message.message_id);

        console.log(`✅ User ${telegramId} submitted check-in for checklist ${checklistId}.`);

    } catch (error) {
        console.error('❌ Error handling submit checkin:', error);
        await sendTelegramMessage(bot, telegramId, "An error occurred while submitting the check-in.");
    }
}

/**
 * Handles the subscription button callback.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 * @param {object} parsedData - The already parsed data from the callback query.
 */
async function handleSubscription(bot, callbackQuery, parsedData) {
    const { from, message } = callbackQuery;
    const userId = from.id;
    const chatId = message.chat.id;
    
    // ✅ FIX: Add a check to ensure plan exists.
    const { plan } = parsedData;
    if (!plan) {
        console.error('❌ Incomplete callback data for subscription. Missing plan.');
        await sendTelegramMessage(bot, userId, "An error occurred. The plan information was incomplete. Please try again.");
        return;
    }

    try {
        const amount = plan === 'premium' ? 1000 : 500;
        const user = await getUserByTelegramId(userId);

        if (!user) {
            await sendTelegramMessage(bot, userId, "User not found. Please start over.");
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
        
    } catch (error) {
        console.error("❌ Error handling subscription callback:", error);
        await sendTelegramMessage(bot, chatId, "Something went wrong while generating the payment link.");
    }
}

module.exports = {
    handleCallbackQuery,
    handleTaskToggle,
    handleSubmitCheckin,
    handleSubscription
};
