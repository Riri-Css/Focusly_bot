// File: src/botInstance.js
const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN);

module.exports = bot;