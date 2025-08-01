const axios = require('axios');

const TELEGRAM_BOT_TOKEN = process.env.BOT_TOKEN; // make sure this is defined in .env or your environment
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

async function sendTelegramMessage(chatId, text) {
  try {
    await axios.post(TELEGRAM_API_URL, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error(`Failed to send Telegram message to ${chatId}:`, error.message);
  }
}

module.exports = { sendTelegramMessage };
