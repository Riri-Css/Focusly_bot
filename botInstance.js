// File: src/botInstance.js
const TelegramBot = require('node-telegram-bot-api');
const TOKEN = process.env.BOT_TOKEN;

// Important: Since you use webhooks, initialize the bot in webhook mode
const bot = new TelegramBot(TOKEN, { webHook: true });

// Register /testbutton command listener ONCE at startup
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

module.exports = bot;
