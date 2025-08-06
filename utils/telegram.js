// File: src/utils/telegram.js
const { createSubscriptionInlineKeyboard } = require('./inlineKeyboards');

// This function sends a message to a user
async function sendTelegramMessage(telegramId, message) {
  // Logic to send a message (assuming you have a bot instance here or pass it)
  // For example:
  // bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  // You might need to adjust this depending on how your bot instance is handled.
  console.log(`Sending message to ${telegramId}: ${message}`);
}

// 🆕 NEW: This function sends a message with subscription buttons
async function sendSubscriptionOptions(bot, chatId) {
  const message = 'Ready to achieve your goals? Choose a plan below to get started!';
  const keyboard = createSubscriptionInlineKeyboard();
  await bot.sendMessage(chatId, message, { reply_markup: keyboard });
}

module.exports = {
  sendTelegramMessage,
  sendSubscriptionOptions, // 🆕 Correctly exporting the new function
};