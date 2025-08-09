// File: src/handlers/callbackHandlers.js
const User = require('../models/user');
const { createChecklistMessage, createChecklistKeyboard, sendTelegramMessage } = require('./messageHandlers');
const { getChecklistByDate } = require('../controllers/userController');
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

/**
 * Main handler for all incoming callback queries.
 * It parses the callback data and routes it to the correct function.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 */
async function handleCallbackQuery(bot, callbackQuery) {
    const { data } = callbackQuery;
    
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
            default:
                await bot.answerCallbackQuery(callbackQuery.id, { text: "Unknown action." });
                break;
        }
    } catch (error) {
        console.error('❌ Error parsing callback data or handling action:', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: "An error occurred." });
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
    const { checklistId, taskId } = parsedData;

    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "User not found. Please start over." });
        }

        const checklist = user.checklists.id(checklistId);
        if (!checklist) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Checklist not found." });
        }

        const task = checklist.tasks.id(taskId);
        if (!task) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Task not found." });
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
        return bot.answerCallbackQuery(callbackQuery.id, { text: task.completed ? "Task completed! ✅" : "Task marked as incomplete." });

    } catch (error) {
        console.error('❌ Error handling task toggle:', error);
        return bot.answerCallbackQuery(callbackQuery.id, { text: "An error occurred." });
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
    const { checklistId } = parsedData;

    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "User not found. Please start over." });
        }

        const checklist = user.checklists.id(checklistId);
        if (!checklist) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: "Checklist not found." });
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
        
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Check-in successful! Your progress is saved." });
        
        await bot.deleteMessage(message.chat.id, message.message_id);

        console.log(`✅ User ${telegramId} submitted check-in for checklist ${checklistId}.`);

    } catch (error) {
        console.error('❌ Error handling submit checkin:', error);
        return bot.answerCallbackQuery(callbackQuery.id, { text: "An error occurred." });
    }
}

module.exports = {
    handleCallbackQuery,
    handleTaskToggle,
    handleSubmitCheckin
};
