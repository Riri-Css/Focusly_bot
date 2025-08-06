// File: src/utils/telegram.js

// This function sends a message to a user
async function sendTelegramMessage(telegramId, message) {
  // Logic to send a message (assuming you have a bot instance here or pass it)
  // For example:
  // bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  // You might need to adjust this depending on how your bot instance is handled.
  console.log(`Sending message to ${telegramId}: ${message}`);
}

// 🆕 This function now creates the keyboard inline to avoid the 'inlineKeyboards' error
async function sendSubscriptionOptions(bot, chatId) {
  const message = 'Ready to achieve your goals? Choose a plan below to get started!';
  
  // 🆕 The inline keyboard is created directly here.
  const keyboard = {
    inline_keyboard: [
      [{ text: 'Premium Plan (GPT-4o) 🚀', callback_data: 'subscribe_premium' }],
      [{ text: 'Basic Plan (GPT-3.5) ✨', callback_data: 'subscribe_basic' }],
    ],
  };
  
  await bot.sendMessage(chatId, message, { 
    reply_markup: keyboard,
    parse_mode: 'Markdown' 
  });
}

module.exports = {
  sendTelegramMessage,
  sendSubscriptionOptions, // Correctly exporting the function
};