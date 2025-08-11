const User = require('../models/user');
const { v4: uuidv4 } = require('uuid');
const { getChecklistFromGoal } = require('../utils/goal_helper');
const { getBotPrompt } = require('../utils/prompt_helper');
const { LLM_MODEL } = require('../config/config');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Global variable for storing the generative model
let genAI = null;
let llmModel = null;

// Initialize the generative AI model
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("GOOGLE_API_KEY environment variable is not set.");
      return null;
    }
    genAI = new GoogleGenerativeAI(apiKey);
    llmModel = genAI.getGenerativeModel({ model: LLM_MODEL });
    console.log("Generative AI model initialized.");
  }
  return llmModel;
}

/**
 * Retrieves a user from the database or creates a new one if they don't exist.
 * @param {string} telegramId The unique ID of the user on Telegram.
 * @returns {Promise<User>} The user document.
 */
async function getOrCreateUser(telegramId) {
    let user = await User.findOne({ telegramId: telegramId });
    if (!user) {
        user = new User({
            telegramId: telegramId,
            streak: 0,
            lastCheckin: null,
            goalMemory: null,
            checklists: [],
            lastCheckinDate: null,
            consecutiveChecks: 0,
        });
        await user.save();
        console.log(`New user created: ${telegramId}`);
    }
    return user;
}

/**
 * Creates a new checklist for the user with unique IDs for the checklist and tasks.
 * @param {User} user The user document.
 * @param {string} weeklyGoal The weekly goal to set.
 * @param {Array} dailyTasks An array of tasks for the checklist.
 * @returns {Object} The newly created checklist.
 */
async function createChecklist(user, weeklyGoal, dailyTasks) {
    if (!user) {
        console.error("User object is null, cannot create checklist.");
        return null;
    }

    const newChecklistId = uuidv4();
    const newTasks = dailyTasks.map(task => ({
        id: uuidv4(),
        text: task.task,
        completed: false,
    }));

    const newChecklist = {
        id: newChecklistId,
        date: new Date(),
        weeklyGoal: weeklyGoal,
        tasks: newTasks,
        checkedIn: false,
    };

    user.checklists.push(newChecklist);
    await user.save();

    console.log(`New checklist created for user ${user.telegramId} with ID: ${newChecklistId}`);
    return newChecklist;
}

/**
 * Handles the daily check-in logic, including streak management and goal setting.
 * @param {User} user The user document.
 */
async function handleDailyCheckinReset(user) {
    if (!user) {
        console.error("User object is null, cannot handle daily check-in.");
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isStreakContinuing = user.lastCheckinDate && new Date(user.lastCheckinDate).getTime() === yesterday.getTime();
    const hasCheckedInToday = user.lastCheckinDate && new Date(user.lastCheckinDate).getTime() === today.getTime();
    const hasExistingChecklist = user.checklists.some(c => new Date(c.date).getTime() === today.getTime());

    if (hasCheckedInToday) {
        console.log(`User ${user.telegramId} has already checked in today. No changes needed.`);
        return;
    }

    if (!isStreakContinuing && user.streak > 0) {
        console.log(`❌ User ${user.telegramId} missed check-in. Streak reset.`);
        user.streak = 0;
    }

    if (!hasExistingChecklist) {
        let dailyChecklist = null;
        if (user.goalMemory && user.goalMemory.text) {
            try {
                // Fetch the goal checklist from the LLM
                dailyChecklist = await getChecklistFromGoal(llmModel, user.goalMemory.text);
            } catch (error) {
                console.error("Error generating daily checklist from goal:", error);
                // Fallback to a default checklist if the LLM call fails
                dailyChecklist = {
                    weeklyGoal: user.goalMemory.text,
                    dailyTasks: [{ task: "Review your weekly goal." }],
                };
            }
        } else {
            // Fallback for users without a goal
            dailyChecklist = {
                weeklyGoal: "No weekly goal set.",
                dailyTasks: [{ task: "Set a new weekly goal!" }],
            };
        }
        await createChecklist(user, dailyChecklist.weeklyGoal, dailyChecklist.dailyTasks);
        console.log(`✅ New checklist created for user ${user.telegramId}.`);
    } else {
        console.log(`User ${user.telegramId} already has a checklist for today. No new checklist created.`);
    }

    await user.save();
}

/**
 * Toggles the completion status of a task in a user's checklist.
 * @param {User} user The user document.
 * @param {string} checklistId The ID of the checklist.
 * @param {string} taskId The ID of the task to toggle.
 * @returns {boolean} True if the task was found and updated, false otherwise.
 */
async function toggleTaskCompletion(user, checklistId, taskId) {
    const checklist = user.checklists.find(c => c.id === checklistId);
    if (!checklist) {
        console.error(`Checklist not found with ID: ${checklistId}`);
        return false;
    }

    const task = checklist.tasks.find(t => t.id === taskId);
    if (!task) {
        console.error(`Task not found with ID: ${taskId} in checklist ${checklistId}`);
        return false;
    }

    task.completed = !task.completed;
    await user.save();
    return true;
}

/**
 * Updates the user's streak and last checkin date, then returns a summary message.
 * @param {User} user The user document.
 * @param {string} checklistId The ID of the checklist being submitted.
 * @returns {string} A summary message.
 */
async function submitCheckin(user, checklistId) {
    if (!user) {
        return "Error: User not found.";
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checklist = user.checklists.find(c => c.id === checklistId);
    if (!checklist) {
        return "Error: Checklist not found.";
    }

    if (checklist.checkedIn) {
        return "You've already submitted your check-in for today!";
    }

    const totalTasks = checklist.tasks.length;
    const completedTasks = checklist.tasks.filter(t => t.completed).length;

    user.lastCheckinDate = today;
    user.streak += 1;
    user.consecutiveChecks += 1;
    checklist.checkedIn = true;
    await user.save();

    const checkinSummary = `*✅ Daily Check-in Submitted!*

Weekly Goal: ${checklist.weeklyGoal || "No goal set yet."}
Today's Progress: ${completedTasks}/${totalTasks} tasks completed.
Your current streak: ${user.streak} days.
`;
    return checkinSummary;
}

/**
 * Generates an inline keyboard for a user's daily checklist.
 * @param {User} user The user document.
 * @returns {object} The inline keyboard object for Telegram.
 */
function getDailyCheckinKeyboard(user) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentChecklist = user.checklists.find(c => new Date(c.date).getTime() === today.getTime());
    if (!currentChecklist) {
        console.error("No checklist found for today.");
        return null;
    }

    const taskButtons = currentChecklist.tasks.map(task => {
        const icon = task.completed ? '✅' : '⬜️';
        const callbackData = `toggle_task|${currentChecklist.id}|${task.id}`;
        return [{
            text: `${icon} ${task.text}`,
            callback_data: callbackData,
        }];
    });

    const submitButton = [{
        text: '➡️ Submit Check-in',
        callback_data: `submit_checkin|${currentChecklist.id}`,
    }];

    return {
        inline_keyboard: [...taskButtons, submitButton],
    };
}

/**
 * Handles incoming Telegram callback queries (e.g., button clicks).
 * @param {object} bot The Telegram bot instance.
 * @param {object} callbackQuery The callback query object from Telegram.
 */
async function handleCallbackQuery(bot, callbackQuery) {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const fromId = callbackQuery.from.id;
    const callbackData = callbackQuery.data;

    // Acknowledge the callback query to remove the loading state
    await bot.answerCallbackQuery(callbackQuery.id);

    // Split the callback data string to get action, checklistId, and taskId
    const [action, checklistId, taskId] = callbackData.split('|');

    console.log(`Received callback query: Action=${action}, Checklist ID=${checklistId}, Task ID=${taskId}`);

    try {
        const user = await getOrCreateUser(fromId);
        if (!user) {
            return bot.sendMessage(chatId, "Sorry, I couldn't find your user account.");
        }

        switch (action) {
            case 'toggle_task':
                await toggleTaskCompletion(user, checklistId, taskId);
                const updatedKeyboard = getDailyCheckinKeyboard(user);
                await bot.editMessageReplyMarkup(updatedKeyboard, {
                    chat_id: chatId,
                    message_id: message.message_id
                });
                break;

            case 'submit_checkin':
                const summary = await submitCheckin(user, checklistId);
                const checkinMessage = `${summary}`;
                await bot.editMessageReplyMarkup(null, {
                    chat_id: chatId,
                    message_id: message.message_id
                });
                await bot.sendMessage(chatId, checkinMessage);
                break;
        }

    } catch (error) {
        console.error(`Error handling callback query: ${error.message}`);
        bot.sendMessage(chatId, "An error occurred while processing your request. Please try again later.");
    }
}

/**
 * Handles incoming Telegram text messages.
 * @param {object} bot The Telegram bot instance.
 * @param {object} msg The message object from Telegram.
 */
async function handleMessage(bot, msg) {
    const chatId = msg.chat.id;
    const fromId = msg.from.id;
    const text = msg.text;

    try {
        const user = await getOrCreateUser(fromId);

        if (!user) {
            return bot.sendMessage(chatId, "Sorry, I couldn't find your user account.");
        }

        if (text.startsWith('/start')) {
            const welcomeMessage = getBotPrompt('welcome');
            await bot.sendMessage(chatId, welcomeMessage);
        } else if (text.startsWith('/setgoal')) {
            const goalText = text.replace('/setgoal', '').trim();
            if (!goalText) {
                return bot.sendMessage(chatId, "Please specify your goal after the command, e.g., `/setgoal Gain 25 new subscribers.`");
            }
            user.goalMemory = { text: goalText };
            await user.save();
            await bot.sendMessage(chatId, `Your new weekly goal has been set: "${goalText}".`);
        } else if (text.startsWith('/checkin')) {
            // This is the correct flow to trigger a check-in
            await handleDailyCheckinReset(user);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const checklist = user.checklists.find(c => new Date(c.date).getTime() === today.getTime());

            if (checklist) {
                const messageText = getBotPrompt('newChecklist', {
                    weeklyGoal: checklist.weeklyGoal,
                });
                const keyboard = getDailyCheckinKeyboard(user);

                if (keyboard) {
                    await bot.sendMessage(chatId, messageText, {
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                    });
                }
            }
        }
    } catch (error) {
        console.error("Error in handleMessage:", error);
        bot.sendMessage(chatId, "An error occurred. Please try again later.");
    }
}

module.exports = {
    getOrCreateUser,
    createChecklist,
    handleDailyCheckinReset,
    toggleTaskCompletion,
    submitCheckin,
    getDailyCheckinKeyboard,
    handleCallbackQuery,
    handleMessage,
    getGenAI,
};
