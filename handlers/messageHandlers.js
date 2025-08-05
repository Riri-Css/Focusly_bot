// File: src/handlers/messageHandlers.js
const { getSmartResponse } = require('../utils/getSmartResponse');
const { getUserByTelegramId, getOrCreateUser, addGoalMemory } = require('../controllers/userController'); // Updated import
const {
  hasAIUsageAccess,
  trackAIUsage,
  getModelForUser,
} = require('../utils/subscriptionUtils');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleMessage(bot, msg) {
  if (!msg || !msg.from || !msg.from.id) {
    console.error("❌ Invalid message format received:", msg);
    return;
  }
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const userInput = msg.text?.trim();

  if (!userInput) {
    await bot.sendMessage(chatId, "Hmm, I didn’t catch that. Try sending it again.");
    return;
  }

  try {
    let user = await getUserByTelegramId(userId);
    if (!user) {
      user = await getOrCreateUser(userId);
    }
    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
      await bot.sendMessage(chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
      return;
    }
    const model = await getModelForUser(user);
    if (!model) {
      await bot.sendMessage(chatId, "Your current plan doesn’t support AI access. Upgrade to continue.");
      return;
    }
    const StrictMode = user.missedCheckins >= 3;
    const { messages: aiReplyMessages } = await getSmartResponse(user.telegramId, userInput, model, StrictMode);
    let aiReply = '';
    if (aiReplyMessages && Array.isArray(aiReplyMessages)) {
      aiReply = aiReplyMessages.filter(m => typeof m === 'string').join('\n\n');
    } else if (typeof aiReplyMessages === 'string') {
      aiReply = aiReplyMessages;
    } else {
      console.error("⚠️ Unexpected AI reply type:", typeof aiReplyRaw, aiReplyRaw);
      await bot.sendMessage(chatId, "The AI didn’t respond properly. Please try again.");
      return;
    }

    // THIS IS THE FIX: addGoalMemory now uses the database directly
    if (userInput.toLowerCase().includes('my goal is')) {
      await addGoalMemory(user, userInput);
      await bot.sendMessage(chatId, "I've saved your goal! I'll generate a daily checklist for you.");
    }
    
    // THIS IS THE FIX: Removed the incorrect streak/check-in logic
    
    if (!aiReply.trim()) {
      console.error("⚠️ Empty AI reply:", aiReplyRaw);
      await bot.sendMessage(chatId, "The AI didn’t return anything useful. Try rephrasing your message.");
      return;
    }
    
    const replyParts = aiReply.split('\n\n');
    for (const part of replyParts) {
      if (part.trim()) {
        await bot.sendMessage(chatId, part.trim());
        await delay(1000);
      }
    }
    await trackAIUsage(user, 'general');

    // This is the correct place to save the user, but we've removed the buggy fields.
    await user.save();
  } catch (error) {
    console.error("❌ Error handling message:", error);
    await bot.sendMessage(chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
};