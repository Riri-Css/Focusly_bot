// File: src/handlers/messageHandlers.js
const { getSmartResponse } = require('../utils/getSmartResponse');
const { 
  getUserByTelegramId, 
  getOrCreateUser, 
  addGoalMemory, 
  addRecentChat, // New function for short-term memory
  addImportantMemory // New function for long-term memory
} = require('../controllers/userController'); 
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
      await bot.sendMessage(chatId, "Your current plan doesn't support AI access. Upgrade to continue.");
      return;
    }

    // --- NEW: Handle the /remember command before anything else ---
    if (userInput.startsWith('/remember')) {
      const textToRemember = userInput.replace('/remember', '').trim();
      if (textToRemember) {
        await addImportantMemory(user, textToRemember);
        await bot.sendMessage(chatId, "Got it. I've added that to your long-term memory.");
      } else {
        await bot.sendMessage(chatId, "What should I remember? Use the command like this: /remember [your important note]");
      }
      return; // Stop processing to avoid AI call
    }
    
    // --- NEW: Add the current message to recent chat history ---
    await addRecentChat(user, userInput);
    
    const StrictMode = user.missedCheckins >= 3;
    // --- IMPORTANT FIX: Passing the entire `user` object to getSmartResponse ---
    const { messages: aiReplyMessages } = await getSmartResponse(user, userInput, model, StrictMode);
    
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
    
    // --- Existing logic for saving a goal ---
    if (userInput.toLowerCase().includes('my goal is')) {
      await addGoalMemory(user, userInput);
      await bot.sendMessage(chatId, "I've saved your goal! I'll generate a daily checklist for you.");
    }
    
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

    // --- REMOVED: Redundant user.save() call. It is handled by the new controller functions. ---
  } catch (error) {
    console.error("❌ Error handling message:", error);
    await bot.sendMessage(chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
};