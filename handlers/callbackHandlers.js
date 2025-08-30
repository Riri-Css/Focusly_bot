// File: src/handlers/callbackHandlers.js - UPDATED VERSION
const User = require('../models/user');
const miniGoal = require('../models/miniGoal'); // NEW: Import the miniGoal model
const {
    toggleTaskCompletion,
    getChecklistById,
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

/**
 * Handles incoming callback queries from inline keyboards.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object.
 */
async function handleCallbackQuery(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        const telegramId = chatId.toString();
        const user = await getOrCreateUser(telegramId);
        
        if (!user) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error: Could not retrieve or create user.' });
            return sendTelegramMessage(bot, chatId, 'Error: Could not retrieve or create user.');
        }

        // --- Handle subscription callbacks (JSON format) ---
        try {
            const parsedData = JSON.parse(data);
            if (parsedData && parsedData.action === 'subscribe') {
                await bot.answerCallbackQuery(callbackQuery.id, { text: 'Preparing your payment link...' });
                const plan = parsedData.plan;
                const planDetails = getPlanDetails(plan);
                
                if (!planDetails) {
                    return sendTelegramMessage(bot, chatId, `Sorry, the details for the ${plan} plan are not available.`);
                }
                
                const amountInNaira = planDetails.price / 100;
                
                const paymentUrl = await generatePaystackLink(user, plan);
                
                if (paymentUrl) {
                    const keyboard = {
                        inline_keyboard: [
                            [{ text: `Proceed to Pay ₦${amountInNaira}`, url: paymentUrl }]
                        ]
                    };
                    await bot.editMessageText(
                        `Click the button below to complete your payment for the **${plan}** plan:`,
                        { chat_id: chatId, message_id: messageId, reply_markup: keyboard, parse_mode: 'Markdown' }
                    );
                } else {
                    await sendTelegramMessage(bot, chatId, 'An error occurred while preparing your payment link. Please try again.');
                }
                return;
            }
        } catch (e) {
            // This is expected for non-JSON callbacks, so we continue.
        }

        // --- Handle checklist & mini-goal callbacks (pipe-separated format) ---
        const [action, id, ...rest] = data.split('|');
        const taskIndex = rest.length > 0 ? parseInt(rest[0], 10) : null;

        await bot.answerCallbackQuery(callbackQuery.id);

        switch (action) {
            case 'editGoal':
                // NEW: Find the user and set a pending edit action
                const editUser = await User.findOne({ telegramId: user.telegramId });
                if (!editUser) {
                    return sendTelegramMessage(bot, chatId, "User not found.");
                }

                // Store the goal ID to be edited in the user's document
                editUser.pendingAction = { type: 'editGoal', goalId: id };
                await editUser.save();

                await sendTelegramMessage(bot, chatId, "✏️ What is the new task and time? Please reply with the new goal and time, for example: 'finish my report at 4pm'.");
                break;
                
            case 'deleteGoal':
                // NEW: Find and delete the mini-goal
                const deletedGoal = await miniGoal.findByIdAndDelete(id);
                if (deletedGoal) {
                    // Edit the message to show a confirmation
                    await bot.editMessageText(
                        `🗑️ The mini-goal to *${deletedGoal.text}* has been deleted.`,
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: [] } // Remove the buttons
                        }
                    );
                } else {
                    await sendTelegramMessage(bot, chatId, "❌ Could not find or delete that mini-goal.");
                }
                break;

            case 'toggle':
                if (taskIndex === null || isNaN(taskIndex)) {
                    await sendTelegramMessage(bot, chatId, 'Invalid task index.');
                    return;
                }
                
                const updatedChecklist = await toggleTaskCompletion(user.telegramId, id, taskIndex);
                if (updatedChecklist) {
                    const keyboard = createChecklistKeyboard(updatedChecklist);
                    const messageText =
                        `Good morning! Here is your daily checklist to push you towards your goal:\n\n` +
                        `**Weekly Goal:** ${user.goalMemory.text}\n\n` +
                        createChecklistMessage(updatedChecklist);

                    await bot.editMessageText(messageText, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });
                } else {
                    await sendTelegramMessage(bot, chatId, 'Task not found.');
                }
                break;

            case 'submit':
                const checklist = await getChecklistById(user.telegramId, id);
                if (checklist.checkedIn) {
                    await sendTelegramMessage(bot, chatId, 'You have already submitted this check-in.');
                    return;
                }

                const submittedUser = await submitCheckin(user, id);
                const submittedChecklist = await getChecklistById(user.telegramId, id);
                const finalMessage = createFinalCheckinMessage(submittedUser, submittedChecklist);

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
};