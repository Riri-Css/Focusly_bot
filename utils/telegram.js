// File: src/utils/telegram.js

// 🆕 This function now requires the bot instance to send the message
async function sendTelegramMessage(bot, telegramId, message) {
  try {
    // This is the actual code to send a message
    await bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    console.log(`✅ Message sent to ${telegramId}`);
  } catch (error) {
    console.error(`❌ Failed to send message to ${telegramId}:`, error);
  }
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