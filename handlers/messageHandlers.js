// File: src/handlers/messageHandlers.js
// This version includes the daily check-in reset logic, AI usage tracking,
// the original AI-driven checklist creation feature, and a fix for the
// inline button callback data to ensure checklist IDs are correctly passed.

const {
    getUserByTelegramId,
    getOrCreateUser,
    addRecentChat,
    addImportantMemory,
    createChecklist,
    getChecklistByDate,
    handleDailyCheckinReset,
    toggleTaskCompletion,
    submitCheckin,
} = require('../controllers/userController');
const { hasAIUsageAccess, trackAIUsage, getModelForUser } = require('../utils/subscriptionUtils');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { sendSubscriptionOptions } = require('../utils/telegram');
const moment = require('moment-timezone');
const User = require('../models/user');

const TIMEZONE = 'Africa/Lagos';

/**
 * Sends a message to a specific chat with optional inline keyboard.
 * @param {object} bot - The Telegram bot instance.
 * @param {number} chatId - The ID of the chat to send the message to.
 * @param {string} messageText - The text of the message.
 * @param {object} [options={}] - Additional options for the message.
 */
async function sendTelegramMessage(bot, chatId, messageText, options = {}) {
    try {
        await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', ...options });
    } catch (error) {
        console.error('❌ Error sending Telegram message:', error);
    }
}

/**
 * Creates the formatted checklist message text.
 * @param {object} checklist - The checklist object.
 * @returns {string} The formatted message string.
 */
function createChecklistMessage(checklist) {
    if (!checklist || !checklist.tasks || checklist.tasks.length === 0) {
        return "You have no tasks for today.";
    }
    const tasksText = checklist.tasks.map(task => {
        // 🐛 FIX: Ensure task text exists before displaying it.
        const taskText = task.text || "Unnamed Task";
        const status = task.completed ? '✅' : '⬜️';
        return `${status} ${taskText}`;
    }).join('\n');
    return tasksText;
}

/**
 * Creates the inline keyboard for a checklist.
 * @param {object} checklist - The checklist object.
 * @returns {object} The inline keyboard object.
 */
function createChecklistKeyboard(checklist) {
    // Check if checklist or checklist.tasks is null/undefined
    if (!checklist || !checklist.tasks || !Array.isArray(checklist.tasks)) {
        console.error("❌ Invalid checklist provided to createChecklistKeyboard.");
        return { inline_keyboard: [] };
    }

    // Ensure checklist.id exists before creating buttons
    if (!checklist.id) {
        console.error("❌ Checklist ID is missing. Cannot create inline keyboard.");
        return { inline_keyboard: [] };
    }

    const taskButtons = checklist.tasks.map(task => {
        // Use a defensive check for task.text to prevent undefined errors
        const taskText = task.text || "Task";
        const buttonText = task.completed ? `✅ ${taskText}` : `⬜️ ${taskText}`;
        return [{
            text: buttonText,
            // 🐛 FIX: Using a compact, pipe-separated string for callback_data
            callback_data: `toggle_task|${checklist.id}|${task.id}`
        }];
    });

    const submitButton = [{
        text: '✅ Submit Check-in',
        // 🐛 FIX: Using a compact string for the submit button's callback_data
        callback_data: `submit_checkin|${checklist.id}`
    }];

    return {
        inline_keyboard: [...taskButtons, submitButton]
    };
}

/**
 * Creates the final check-in message text.
 * @param {object} user - The user object.
 * @param {object} checklist - The checklist object.
 * @returns {string} The formatted message string.
 */
function createFinalCheckinMessage(user, checklist) {
    const completedTasksCount = checklist.tasks.filter(task => task.completed).length;
    const totalTasksCount = checklist.tasks.length;
    let message = `**Check-in Complete!** 🎉\n\n`;
    message += `You completed **${completedTasksCount}** out of **${totalTasksCount}** tasks today.\n`;
    message += `Your current streak is now at **${user.streak}** days! Keep up the great work!`;
    return message;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handles incoming messages from the user.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} msg - The message object from Telegram.
 */
async function handleMessage(bot, msg) {
    if (!msg || !msg.from || !msg.from.id) {
        console.error("❌ Invalid message format received:", msg);
        return;
    }

    try {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const userInput = msg.text?.trim();

        if (!userInput) {
            await sendTelegramMessage(bot, chatId, "Hmm, I didn’t catch that. Try sending it again.");
            return;
        }

        let user = await getOrCreateUser(userId);

        // Call the daily check-in reset logic at the beginning of message handling
        await handleDailyCheckinReset(user);

        const command = userInput.toLowerCase();

        if (command === '/start') {
            if (user.onboardingStep === 'awaiting_goal') {
                return sendTelegramMessage(bot, chatId, `Hi ${msg.from.first_name}! 👋 Welcome to Focusly. Let's start with your first weekly goal. What's one thing you want to achieve this week?`);
            } else if (user.onboardingStep !== 'onboarded') {
                user.onboardingStep = 'awaiting_goal';
                await user.save();
                return sendTelegramMessage(bot, chatId, `Hi ${msg.from.first_name}! 👋 Welcome to Focusly. Let's start with your first weekly goal. What's one thing you want to achieve this week?`);
            } else {
                return sendTelegramMessage(bot, chatId, `Welcome back, ${msg.from.first_name}! You've already started. Use the /checkin command to get your checklist.`);
            }
        }

        if (command === '/subscription') {
            const now = moment().tz(TIMEZONE).toDate();
            const isExpired = user.subscriptionEndDate && user.subscriptionEndDate < now;
            const isActive = user.subscriptionStatus === 'active' && !isExpired;
            const isPremium = user.subscriptionPlan === 'premium' && isActive;
            
            if (isActive) {
                await sendTelegramMessage(bot, chatId, `You are currently on the **${user.subscriptionPlan}** plan, which expires on **${moment(user.subscriptionEndDate).tz(TIMEZONE).format('LL')}**. Thank you for your continued support!`);
            } else {
                await sendSubscriptionOptions(bot, chatId, isPremium);
            }
            return;
        }

        if (command === '/checkin') {
            if (!user.goalMemory || !user.goalMemory.text) {
                return sendTelegramMessage(bot, chatId, "You don't have a goal set yet! Use `/start` or `/setgoal` to define your weekly goal.");
            }
            const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
            const checklist = await getChecklistByDate(user.telegramId, today);
            if (checklist) {
                if (checklist.checkedIn) {
                    return sendTelegramMessage(bot, chatId, `You've already checked in for today! You completed ${checklist.tasks.filter(t => t.completed).length} out of ${checklist.tasks.length} tasks. Great job!`);
                } else {
                    // Send the same checklist if it exists and is not checked in
                    const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` + createChecklistMessage(checklist);
                    const keyboard = createChecklistKeyboard(checklist);
                    return sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                }
            } else {
                // Create a new checklist if it doesn't exist
                const hasAccess = await hasAIUsageAccess(user);
                if (!hasAccess) {
                    return sendTelegramMessage(bot, chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
                }
                const model = await getModelForUser(user);
                if (!model) {
                    return sendTelegramMessage(bot, chatId, "Your current plan doesn't support AI access. Upgrade to continue.");
                }
                
                const { daily_tasks, weekly_goal } = await getSmartResponse(user, `Create a daily checklist for my weekly goal: ${user.goalMemory.text}`, model);

                if (daily_tasks && daily_tasks.length > 0) {
                    const newChecklist = await createChecklist(user, weekly_goal || user.goalMemory.text, daily_tasks);
                    const messageText = `Got it. Here is your daily checklist to get you started:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` + createChecklistMessage(newChecklist);
                    const keyboard = createChecklistKeyboard(newChecklist);
                    await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                    await trackAIUsage(user, 'checklist');
                } else {
                    await sendTelegramMessage(bot, chatId, "I couldn't create a checklist based on your goal. Can you try setting a more specific goal?");
                }
            }
            return;
        }

        if (command.startsWith('/remember')) {
            const textToRemember = command.replace('/remember', '').trim();
            if (textToRemember) {
                await addImportantMemory(user, textToRemember);
                await sendTelegramMessage(bot, chatId, "Got it. I've added that to your long-term memory.");
            } else {
                await sendTelegramMessage(bot, chatId, "What should I remember? Use the command like this: /remember [your important note]");
            }
            return;
        }
        
        if (user && user.onboardingStep === 'awaiting_goal') {
            if (userInput && userInput.length > 5) {
                user.goalMemory.text = userInput;
                user.onboardingStep = 'onboarded';
                await user.save();
                return sendTelegramMessage(bot, chatId, "Awesome! I've set your weekly goal. I'll send you a daily checklist to help you stay on track. Just type /checkin when you're ready to see it.");
            } else {
                return sendTelegramMessage(bot, chatId, "Please provide a more detailed goal. What's one thing you want to achieve this week?");
            }
        }

        // This section handles general AI responses for non-command messages.
        const hasAccess = await hasAIUsageAccess(user);
        if (!hasAccess) {
            return sendTelegramMessage(bot, chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
        }
        const model = await getModelForUser(user);
        if (!model) {
            return sendTelegramMessage(bot, chatId, "Your current plan doesn't support AI access. Upgrade to continue.");
        }

        await addRecentChat(user, userInput);
        
        const { message, intent, challenge_message, weekly_goal, daily_tasks } = await getSmartResponse(user, userInput, model);

        if (intent === 'create_checklist') {
            if (challenge_message) {
                await sendTelegramMessage(bot, chatId, challenge_message);
                await delay(1500);
            }
            
            if (daily_tasks && daily_tasks.length > 0) {
                // This is where the AI-driven checklist creation happens
                const newChecklist = await createChecklist(user, weekly_goal, daily_tasks);
                const messageText = `Got it. Here is your daily checklist to get you started:\n\n**Weekly Goal:** ${weekly_goal}\n\n` + createChecklistMessage(newChecklist);
                const keyboard = createChecklistKeyboard(newChecklist);
                await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                await trackAIUsage(user, 'checklist');
            } else {
                await sendTelegramMessage(bot, chatId, "I couldn't create a checklist based on that. Can you be more specific?");
            }
            await trackAIUsage(user, 'checklist');
        } else if (message) {
            await sendTelegramMessage(bot, chatId, message);
            await trackAIUsage(user, 'general');
        } else {
            await sendTelegramMessage(bot, chatId, "I'm sorry, I don't understand that command. Please focus on your current goal and use the /checkin command when you're ready.");
        }
        
    } catch (error) {
        console.error("❌ Error handling message:", error);
        await sendTelegramMessage(bot, chatId, "Something went wrong while processing your message. Please try again.");
    }
}

/**
 * Handles incoming callback queries from the inline keyboard.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 */
async function handleCallbackQuery(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    // Acknowledge the callback query to remove the loading animation
    await bot.answerCallbackQuery(callbackQuery.id);

    try {
        const user = await getOrCreateUser(chatId);
        if (!user) {
            return sendTelegramMessage(bot, chatId, "Error: Could not retrieve or create user.");
        }

        // 🐛 FIX: Parse the compact, pipe-separated callback data
        const [action, checklistId, taskId] = data.split('|');

        switch (action) {
            case 'toggle_task':
                const updatedChecklist = await toggleTaskCompletion(user, checklistId, taskId);
                if (updatedChecklist) {
                    const keyboard = createChecklistKeyboard(updatedChecklist);
                    const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` + createChecklistMessage(updatedChecklist);
                    
                    bot.editMessageText(messageText, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                }
                break;

            case 'submit_checkin':
                const submittedUser = await submitCheckin(user, checklistId);
                const finalChecklist = await getChecklistByDate(user.telegramId, moment().tz(TIMEZONE).format('YYYY-MM-DD'));
                const finalMessage = createFinalCheckinMessage(submittedUser, finalChecklist);
                
                await bot.editMessageText(finalMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [] }
                });
                break;

            default:
                await sendTelegramMessage(bot, chatId, "An unknown action was requested.");
                break;
        }

    } catch (error) {
        console.error('❌ Error handling callback query:', error);
        await sendTelegramMessage(bot, chatId, "An error occurred while processing your request.");
    }
}

module.exports = {
    handleMessage,
    handleCallbackQuery,
    createChecklistMessage,
    createChecklistKeyboard,
    createFinalCheckinMessage,
    sendTelegramMessage
};
