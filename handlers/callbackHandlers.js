// src/handlers/callbackHandlers.js
const User = require('../models/user');
const { createChecklistMessage, createChecklistKeyboard, sendTelegramMessage } = require('./messageHandlers');
const { getChecklistByDate } = require('../controllers/userController');
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

/**
 * Handles toggling the completion status of a checklist task.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} callbackQuery - The callback query object from Telegram.
 * @param {object} parsedData - The already parsed data from the callback query.
 */
async function handleTaskToggle(bot, callbackQuery, parsedData) {
    const { from, message } = callbackQuery;
    const telegramId = from.id;
    // 🆕 Use the already parsed data
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

        // Toggle the completion status
        task.completed = !task.completed;

        await user.save();

        // Update the message in the chat
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
    // 🆕 Use the already parsed data
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

        // Set the checklist as checked in
        checklist.checkedIn = true;
        
        // Count completed tasks
        const completedTasks = checklist.tasks.filter(task => task.completed).length;
        const totalTasks = checklist.tasks.length;
        
        // Build a dynamic message based on performance
        let completionMessage;
        if (completedTasks === totalTasks) {
            completionMessage = `**Amazing! You completed all your tasks today!** 🎉 Keep up this incredible momentum! Your consistency will lead to great results.`;
        } else if (completedTasks > 0) {
            completionMessage = `**Great job!** You completed ${completedTasks} out of ${totalTasks} tasks today. Every step forward counts! Let's aim to knock out the rest tomorrow. 💪`;
        } else {
            completionMessage = `**That's okay!** You can't win them all, but every day is a new chance to try. Let's make tomorrow a day of progress!`;
        }

        // Send the confirmation message
        await sendTelegramMessage(bot, telegramId, `✅ **Check-in Successful!**\n\n${completionMessage}\n\nI've saved your progress for today. Now, rest well and prepare for an even better day tomorrow!`);

        // Save the updated user document
        await user.save();
        
        // Answer the callback query and clear the original checklist message
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Check-in successful! Your progress is saved." });
        
        // Delete the original message to keep the chat clean
        await bot.deleteMessage(message.chat.id, message.message_id);

        console.log(`✅ User ${telegramId} submitted check-in for checklist ${checklistId}.`);

    } catch (error) {
        console.error('❌ Error handling submit checkin:', error);
        return bot.answerCallbackQuery(callbackQuery.id, { text: "An error occurred." });
    }
}

module.exports = {
    handleTaskToggle,
    handleSubmitCheckin
};
