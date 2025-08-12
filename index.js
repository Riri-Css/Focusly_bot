// File: index.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

// Import the SINGLE bot instance from botInstance.js
const bot = require('./botInstance');

// Import handlers for different types of updates
const { handleMessage } = require('./handlers/messageHandlers');
const { handleCallbackQuery } = require('./handlers/callbackHandlers');

// Listen for new text messages
bot.on('message', async (msg) => {
    try {
        await handleMessage(bot, msg);
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Listen for callback queries (button presses)
bot.on('callback_query', async (query) => {
    try {
        await handleCallbackQuery(bot, query);
    } catch (error) {
        console.error('Error handling callback query:', error);
    }
});

module.exports = bot; // Export bot for use elsewhere (if needed)
