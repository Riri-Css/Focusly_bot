// File: src/handlers/messageHandlers.js - FINAL VERSION

const {
    getOrCreateUser,
    addRecentChat,
    addImportantMemory,
    getChecklistByDate,
    handleDailyCheckinReset,
    createAndSaveChecklist
} = require('../controllers/userController');
const { hasAIUsageAccess, trackAIUsage } = require('../utils/subscriptionUtils');
const { sendSubscriptionOptions } = require('../utils/telegram');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { updateSubscription } = require('../utils/adminUtils');
const moment = require('moment-timezone');
const miniGoal = require('../models/miniGoal');
const User = require('../models/user'); // Ensure your User model is imported

const TIMEZONE = 'Africa/Lagos';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

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
    if (!checklist || !checklist.tasks || !Array.isArray(checklist.tasks) || !checklist._id) {
        console.error("❌ Invalid checklist provided or missing _id to createChecklistKeyboard.");
        return { inline_keyboard: [] };
    }

    const taskButtons = checklist.tasks.map((task, index) => {
        const taskText = (task.text || "Task").substring(0, 30);
        const buttonText = task.completed ? `✅ ${taskText}` : `⬜️ ${taskText}`;
        
        return [{
            text: buttonText,
            callback_data: `toggle|${checklist._id}|${index}`
        }];
    });

    const submitButton = [{
        text: '✅ Submit Check-in',
        callback_data: `submit|${checklist._id}`
    }];

    return {
        inline_keyboard: [...taskButtons, submitButton]
    };
}

/**
 * Creates the final check-in message text based on performance and streak.
 * @param {object} user - The user object.
 * @param {object} checklist - The checklist object.
 * @returns {string} The formatted message string with dynamic attitude.
 */
function createFinalCheckinMessage(user, checklist) {
    const completedTasksCount = checklist.tasks.filter(task => task.completed).length;
    const totalTasksCount = checklist.tasks.length;
    const completionPercentage = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0;
    const streakCount = user.streak || 0;

    let message = `**Check-in Complete!** 🎉\n\n`;

    if (completionPercentage === 100) {
        message += `You crushed it! You completed **all ${totalTasksCount} tasks** today. This is the consistency we're looking for! Keep it up! 💪`;
    } else if (completionPercentage > 50) {
        message += `Great job! You completed **${completedTasksCount} out of ${totalTasksCount} tasks**. You're building solid momentum. Let's get to 100% tomorrow!`;
    } else if (completionPercentage > 0) {
        message += `Alright, let's pick up the pace. You completed **${completedTasksCount} out of ${totalTasksCount} tasks**. Don't let those goals slip away. Consistency is key! 😠`;
    } else {
        message += `You completed **0 out of ${totalTasksCount} tasks**. I know it's tough, but you can't hit your goals if you don't even start. The tasks you missed have been added to your list for tomorrow. Get to work! 😤`;
    }

    message += `\n\nYour current streak is now at **${streakCount}** days.`;
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
        await sendTelegramMessage(bot, chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset. Type /subscription to see available plans.");
        return null;
    }
    const model = user.gptVersion; // Use the gptVersion from the user object
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

    const telegramId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const userInput = msg.text?.trim();

    try {
        if (!userInput) {
            await sendTelegramMessage(bot, chatId, "Sorry, I can only process text messages. Please try sending it again with words.");
            return;
        }

        let user = await getOrCreateUser(telegramId);
        await handleDailyCheckinReset(user);

        // NEW: Check for a pending goal edit first
        if (user.pendingAction && user.pendingAction.type === 'editGoal') {
            const goalId = user.pendingAction.goalId;
            const reminderRegex = /(.+?) at (\d{1,2}(?::\d{2})?\s?(am|pm)?)/i;
            const match = reminderRegex.exec(userInput);

            if (match) {
                const task = match[1];
                const timeString = match[2];
                const reminderTime = moment.tz(timeString, ["hA", "h:mmA"], TIMEZONE);

                if (!reminderTime.isValid()) {
                    await sendTelegramMessage(bot, chatId, `⚠️ I couldn’t understand the new time. Please use a format like *2pm* or *14:00*. Please try again.`);
                    return;
                }

                const updatedGoal = await miniGoal.findByIdAndUpdate(goalId, { 
                    text: task, 
                    time: reminderTime.toDate() 
                }, { new: true });

                if (updatedGoal) {
                    user.pendingAction = null; // Clear the pending action
                    await user.save();
                    await sendTelegramMessage(bot, chatId, `✅ Your mini-goal has been updated to *${task}* at ${reminderTime.format("h:mm A")}.`);
                } else {
                    await sendTelegramMessage(bot, chatId, "❌ The goal you were trying to edit was not found.");
                }
            } else {
                await sendTelegramMessage(bot, chatId, "❌ That's not a valid format. Please provide the new task and time, for example: 'finish my report at 4pm'.");
            }
            return;
        }

        const command = userInput.toLowerCase().split(' ')[0];

        // --- Mini Goal / Reminder Detection ---
        const reminderRegex = /remind me to (.+?) at (\d{1,2}(?::\d{2})?\s?(am|pm)?)/i;
        const vagueReminderRegex = /remind me to (.+?) (this|tomorrow)?\s?(morning|afternoon|evening|night)?/i;

        let reminderMatch = reminderRegex.exec(userInput);
        let vagueMatch = vagueReminderRegex.exec(userInput);

        if (reminderMatch) {
            const task = reminderMatch[1];
            const timeString = reminderMatch[2];
            const reminderTime = moment.tz(timeString, ["hA", "h:mmA"], TIMEZONE);

            if (!reminderTime.isValid()) {
                await sendTelegramMessage(bot, chatId, `⚠️ I couldn’t understand the time. Please use a format like *2pm* or *14:00*.`);
                return;
            }

            const newReminder = new miniGoal({
                userId: user._id,
                telegramId: user.telegramId,
                text: task,
                time: reminderTime.toDate()
            });

            await newReminder.save();
            await sendTelegramMessage(bot, chatId, `✅ Got it! I’ll remind you to *${task}* at ${reminderTime.format("h:mm A")}.`);
            return;
        }

        if (vagueMatch) {
            const task = vagueMatch[1];
            user.pendingReminder = { task }; // store temporarily in user object
            await user.save();
            await sendTelegramMessage(bot, chatId, `⏰ What exact time should I remind you to *${task}*?`);
            return;
        }

        // Handle user response to pending vague reminder
        if (user.pendingReminder && moment(userInput, ["hA", "h:mmA"], true).isValid()) {
            const reminderTime = moment.tz(userInput, ["hA", "h:mmA"], TIMEZONE);
            const { task } = user.pendingReminder;

            const newReminder = new miniGoal({
                userId: user._id,
                telegramId: user.telegramId,
                text: task,
                time: reminderTime.toDate()
            });

            await newReminder.save();

            user.pendingReminder = null;
            await user.save();

            await sendTelegramMessage(bot, chatId, `✅ Got it! I’ll remind you to *${task}* at ${reminderTime.format("h:mm A")}.`);
            return;
        }

        // --- Handle commands ---
        if (command === '/allowaccess') {
            if (msg.from.id.toString() !== ADMIN_TELEGRAM_ID) {
                return sendTelegramMessage(bot, chatId, "🚫 You are not authorized to use this command.");
            }
            const parts = userInput.split(' ');
            if (parts.length !== 3) {
                return sendTelegramMessage(bot, chatId, "Usage: /allowaccess <telegramId> <plan>");
            }
            const targetTelegramId = parts[1];
            const plan = parts[2].toLowerCase();
            if (['premium', 'basic', 'pro', 'free'].includes(plan)) {
                try {
                    const updatedUser = await updateSubscription(targetTelegramId, plan);
                    if (updatedUser) {
                        await sendTelegramMessage(bot, chatId, `✅ Successfully updated subscription for user ${targetTelegramId} to ${plan}.`);
                        await sendTelegramMessage(bot, updatedUser.telegramId, 
                            `🎉 Congratulations! Your subscription has been manually updated to the **${plan}** plan. You now have full access to Focusly! Get started with /checkin.`
                        );
                    } else {
                        await sendTelegramMessage(bot, chatId, `User with ID ${targetTelegramId} not found.`);
                    }
                } catch (error) {
                    console.error("❌ Error with /allowaccess command:", error);
                    await sendTelegramMessage(bot, chatId, `❌ An error occurred while updating the subscription.`);
                }
            } else {
                await sendTelegramMessage(bot, chatId, `Invalid plan. Please use 'premium', 'basic', 'pro', or 'free'.`);
            }
            return;
        }

        if (command === '/testbutton') {
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
                await sendSubscriptionOptions(bot, chatId, isPremium, sendTelegramMessage);
            }
            return;
        }

        if (command === '/checkin') {
            if (!user.goalMemory || !user.goalMemory.text) {
                return sendTelegramMessage(bot, chatId, "You don't have a goal set yet! Use `/start` or `/setgoal` to define your weekly goal.");
            }
            const today = moment().tz(TIMEZONE).startOf('day').toDate();
            const checklist = await getChecklistByDate(user.telegramId, today);
            
            if (checklist) {
                if (checklist.checkedIn) {
                    const finalMessage = createFinalCheckinMessage(user, checklist);
                    return sendTelegramMessage(bot, chatId, finalMessage);
                } else {
                    const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` + createChecklistMessage(checklist);
                    const keyboard = createChecklistKeyboard(checklist);
                    return sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                }
            } else {
                const model = await checkAIUsageAndGetModel(user, chatId, bot);
                if (!model) {
                    return;
                }
                const aiResponse = await getSmartResponse(user, 'create_checklist', { 
                    goalMemory: user.goalMemory
                });

                if (aiResponse.intent === 'create_checklist' && aiResponse.daily_tasks && aiResponse.daily_tasks.length > 0) {
                    const newChecklist = await createAndSaveChecklist(user.telegramId, aiResponse);
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

        if (command === '/remember') {
            const textToRemember = userInput.replace('/remember', '').trim();
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
        
        // --- NEW: AI-powered conversational intent handling ---
        const model = await checkAIUsageAndGetModel(user, chatId, bot);
        if (!model) {
            return;
        }

        await addRecentChat(user, userInput);
        
        const aiResponse = await getSmartResponse(user, 'conversational_intent', { userInput: userInput });

        if (aiResponse.intent === 'list_mini_goals') {
            const userGoals = await miniGoal.find({ telegramId: user.telegramId }).sort({ time: 1 });
            if (userGoals.length === 0) {
                return sendTelegramMessage(bot, chatId, "You don't have any mini-goals set yet. To set one, just say 'remind me to [task] at [time]'.");
            }

            // Send an introductory message first to create a clean heading for the list
            await sendTelegramMessage(bot, chatId, '📝 **Your Mini-Goals:**');

            // Loop through each goal and send it in a separate message with its own buttons
            for (const goal of userGoals) {
                const formattedTime = moment(goal.time).tz(TIMEZONE).format("h:mm A");
                const messageText = `*${goal.text}* at ${formattedTime}`;

                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '✏️ Edit', callback_data: `editGoal|${goal._id}` },
                            { text: '🗑️ Delete', callback_data: `deleteGoal|${goal._id}` }
                        ]
                    ]
                };

                await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
            }
            return;
        } else if (aiResponse.intent === 'list_all_goals') {
            let messageText = '📝 **Your Goals:**\n\n';
            if (user.goalMemory && user.goalMemory.text) {
                messageText += `**Main Goal:**\n*${user.goalMemory.text}*\n\n`;
            } else {
                messageText += "You haven't set a main goal yet. Use `/start` to set one.\n\n";
            }
            const userGoals = await miniGoal.find({ telegramId: user.telegramId }).sort({ time: 1 });
            if (userGoals.length > 0) {
                messageText += `**Mini-Goals:**\n`;
                for (const [index, goal] of userGoals.entries()) {
                    const formattedTime = moment(goal.time).tz(TIMEZONE).format("h:mm A");
                    const goalText = goal.text;
                    messageText += `${index + 1}. *${goalText}* at ${formattedTime}\n`;
                }
            } else {
                messageText += "You don't have any mini-goals yet. You can ask me to remind you to do something at a specific time.\n";
            }
            await sendTelegramMessage(bot, chatId, messageText);
            return;
        } else if (aiResponse.intent === 'create_checklist') {
            if (aiResponse.challenge_message) {
                await sendTelegramMessage(bot, chatId, aiResponse.challenge_message);
                await delay(1500);
            }
            if (aiResponse.daily_tasks && aiResponse.daily_tasks.length > 0) {
                const newChecklist = await createAndSaveChecklist(user.telegramId, aiResponse);
                const messageText = `Got it. Here is your daily checklist to get you started:\n\n**Weekly Goal:** ${newChecklist.weeklyGoal}\n\n` + createChecklistMessage(newChecklist);
                const keyboard = createChecklistKeyboard(newChecklist);
                await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                await trackAIUsage(user, 'checklist');
            } else {
                await sendTelegramMessage(bot, chatId, "I couldn't create a checklist based on that. Can you be more specific?");
            }
        } else if (aiResponse.message) {
            await sendTelegramMessage(bot, chatId, aiResponse.message);
            await trackAIUsage(user, 'general');
        } else {
            await sendTelegramMessage(bot, chatId, "I'm sorry, I don't understand that. Please focus on your current goal and use the /checkin command when you're ready.");
        }
    } catch (error) {
        console.error("❌ Error handling message:", error);
        await sendTelegramMessage(bot, chatId, "Something went wrong while processing your message. Please try again.");
    }
}
module.exports = {
    handleMessage,
    createChecklistMessage,
    createChecklistKeyboard,
    createFinalCheckinMessage,
    sendTelegramMessage
};