// File: src/handlers/callbackHandlers.js - CORRECTED
const User = require('../models/user');
const {
  getChecklistById,
  updateChecklist,
  submitCheckin,
  getOrCreateUser,
} = require('../controllers/userController');
const {
  createChecklistKeyboard,
  createChecklistMessage,
  createFinalCheckinMessage,
  sendTelegramMessage,
} = require('./messageHandlers');
const { generatePaystackLink } = require('../utils/paystackUtils');
const { getPlanDetails } = require('../utils/subscriptionUtils'); // <-- NEW: Import the centralized function
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

// ... (rest of the file remains the same until handleCallbackQuery)

async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;

  await bot.answerCallbackQuery(callbackQuery.id);

  try {
    const telegramId = chatId.toString();
    const user = await getOrCreateUser(telegramId);
    if (!user) {
      return sendTelegramMessage(bot, chatId, 'Error: Could not retrieve or create user.');
    }

    let parsedData;
    try {
        parsedData = JSON.parse(data);
    } catch (e) {
        parsedData = null;
    }
    
    if (parsedData && parsedData.action === 'subscribe') {
        const plan = parsedData.plan;
        
        // --- CORRECTED CODE: Use the centralized plan details ---
        const planDetails = getPlanDetails(plan);

        if (!planDetails) {
            return sendTelegramMessage(bot, chatId, `Sorry, the price for the ${plan} plan is not available.`);
        }
        
        const amount = planDetails.price; // Price in Naira for the button text
        const amountInKobo = planDetails.priceInKobo; // Price in kobo for Paystack API

        // Pass the correct amountInKobo to the Paystack function
        const paymentUrl = await generatePaystackLink(user, amountInKobo, plan);
        // --- END CORRECTED CODE ---

        if (paymentUrl) {
            const keyboard = {
                inline_keyboard: [
                    [{ text: `Proceed to Pay ₦${amount}`, url: paymentUrl }]
                ]
            };
            await sendTelegramMessage(bot, chatId, 
                `Click the button below to complete your payment for the **${plan}** plan:`, 
                { reply_markup: keyboard }
            );
        } else {
            await sendTelegramMessage(bot, chatId, 'An error occurred while preparing your payment link. Please try again.');
        }
        return;
    }

    // ... (rest of the file for checklist logic remains the same)
}

module.exports = {
  handleCallbackQuery,
  registerTestButtonCommand,
};