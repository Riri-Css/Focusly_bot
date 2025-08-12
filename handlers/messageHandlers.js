// File: src/handlers/messageHandlers.js
// This version uses the existing userController to handle all database operations.

const {
    getUserByTelegramId,
    getOrCreateUser,
    addRecentChat,
    addImportantMemory,
    getChecklistByDate,
    handleDailyCheckinReset,
    submitCheckin,
    createAndSaveChecklist, // Assuming this new function exists in your userController
    getChecklistById, // Assuming this new function exists in your userController
    updateChecklist // Assuming this new function exists in your userController
} = require('../controllers/userController');
const { hasAIUsageAccess, trackAIUsage, getModelForUser } = require('../utils/subscriptionUtils');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { sendSubscriptionOptions } = require('../utils/telegram');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid'); // Used for generating unique IDs

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
    if (!checklist || !checklist.tasks || !Array.isArray(checklist.tasks) || !checklist.id) {
        console.error("❌ Invalid checklist provided or missing ID to createChecklistKeyboard.");
        return { inline_keyboard: [] };
    }

    const taskButtons = checklist.tasks.map((task, index) => { // <-- ADDED 'index' HERE
        const taskText = task.text || "Task";
        const buttonText = task.completed ? `✅ ${taskText}` : `⬜️ ${taskText}`;
        
        // --- FIX: Using the array index instead of the long UUID for the task.id
        return [{
            text: buttonText,
            callback_data: `toggle_task|${checklist.id}|${index}`
        }];
    });

    const submitButton = [{
        text: '✅ Submit Check-in',
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
 * A helper function to check AI usage access and get the appropriate model.
 * If access is denied, it sends a message and returns null.
 * @param {object} user - The user object.
 * @param {number} chatId - The ID of the chat.
 * @param {object} bot - The Telegram bot instance.
 * @returns {Promise<string|null>} The model string or null if access is denied.
 */
async function checkAIUsageAndGetModel(user, chatId, bot) {
    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
        await sendTelegramMessage(bot, chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
        return null;
    }
    const model = await getModelForUser(user);
    if (!model) {
        await sendTelegramMessage(bot, chatId, "Your current plan doesn't support AI access. Upgrade to continue.");
        return null;
    }
    return model;
}

/**
 * Handles incoming messages from the user.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} msg - The message object from Telegram.
 */
async function handleMessage(bot, msg) {
    if (!msg || !msg.from || !msg.from.id || !msg.chat || !msg.chat.id) {
        console.error("❌ Invalid message format or missing chatId received:", msg);
        return;
    }

    // CHANGE HERE: convert userId to telegramId string
    const telegramId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const userInput = msg.text?.trim();

    try {
        if (!userInput) {
            await sendTelegramMessage(bot, chatId, "Hmm, I didn’t catch that. Try sending it again.");
            return;
        }

        let user = await getOrCreateUser(telegramId);
        await handleDailyCheckinReset(user);

        const command = userInput.toLowerCase();

        if (userInput === '/testbutton') {
  await sendTelegramMessage(bot, chatId, "Click a button below:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Test Callback", callback_data: "test_callback" }
        ]
      ]
    }
  });
  return;
}


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
                    const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` + createChecklistMessage(checklist);
                    const keyboard = createChecklistKeyboard(checklist);
                    return sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                }
            } else {
                const model = await checkAIUsageAndGetModel(user, chatId, bot);
                if (!model) {
                    return; // Return early if access is denied
                }
                
                const { daily_tasks, weekly_goal } = await getSmartResponse(user, `Create a daily checklist for my weekly goal: ${user.goalMemory.text}`, model);

                if (daily_tasks && daily_tasks.length > 0) {
                    const newChecklist = {
                        id: uuidv4(),
                        weeklyGoal: weekly_goal || user.goalMemory.text,
                        tasks: daily_tasks.map(task => ({
                            ...task,
                            id: uuidv4(),
                            completed: false
                        })),
                        checkedIn: false,
                        createdAt: new Date().toISOString()
                    };
                    await createAndSaveChecklist(telegramId, newChecklist);

                    const messageText = `Got it. Here is your daily checklist to get you started:\n\n**Weekly Goal:** ${newChecklist.weeklyGoal}\n\n` + createChecklistMessage(newChecklist);
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

        const model = await checkAIUsageAndGetModel(user, chatId, bot);
        if (!model) {
            return; // Return early if access is denied
        }

        await addRecentChat(user, userInput);
        
        const { message, intent, challenge_message, weekly_goal, daily_tasks } = await getSmartResponse(user, userInput, model);

        if (intent === 'create_checklist') {
            if (challenge_message) {
                await sendTelegramMessage(bot, chatId, challenge_message);
                await delay(1500);
            }
            
            if (daily_tasks && daily_tasks.length > 0) {
                const newChecklist = {
                    id: uuidv4(),
                    weeklyGoal: weekly_goal || user.goalMemory.text,
                    tasks: daily_tasks.map(task => ({
                        ...task,
                        id: uuidv4(),
                        completed: false
                    })),
                    checkedIn: false,
                    createdAt: new Date().toISOString()
                };
                await createAndSaveChecklist(telegramId, newChecklist);

                const messageText = `Got it. Here is your daily checklist to get you started:\n\n**Weekly Goal:** ${newChecklist.weeklyGoal}\n\n` + createChecklistMessage(newChecklist);
                const keyboard = createChecklistKeyboard(newChecklist);
                await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                await trackAIUsage(user, 'checklist');
            } else {
                await sendTelegramMessage(bot, chatId, "I couldn't create a checklist based on that. Can you be more specific?");
            }
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

    // TEST COMMAND TO CHECK CALLBACK QUERIES
bot.onText(/\/testbutton/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, "Click a button below:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Test Callback", callback_data: "test_callback" }
        ]
      ]
    }
  });
});

    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    await bot.answerCallbackQuery(callbackQuery.id);

    try {
        // CHANGE HERE: Use chatId as telegramId string
        const telegramId = chatId.toString();
        const user = await getOrCreateUser(telegramId);
        if (!user) {
            return sendTelegramMessage(bot, chatId, "Error: Could not retrieve or create user.");
        }

        const [action, checklistId, taskIndexStr] = data.split('|');
        let checklist = await getChecklistById(user.telegramId, checklistId);
        const taskIndex = parseInt(taskIndexStr, 10);

        if (!checklist) {
            console.error(`❌ Checklist ID ${checklistId} not found during callback.`);
            await sendTelegramMessage(bot, chatId, "Sorry, I couldn't find that checklist. It may have been replaced by a new one.");
            return;
        }
        
        switch (action) {
            case 'toggle_task':
                const taskToToggle = checklist.tasks[taskIndex];
                if (taskToToggle) {
                    taskToToggle.completed = !taskToToggle.completed;
                    await updateChecklist(user.telegramId, checklist);

                    const keyboard = createChecklistKeyboard(checklist);
                    const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` + createChecklistMessage(checklist);
                    
                    await bot.editMessageText(messageText, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
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
