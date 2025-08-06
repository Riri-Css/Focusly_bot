// File: src/handlers/messageHandlers.js
const { getSmartResponse } = require('../utils/getSmartResponse');
const { 
  getUserByTelegramId, 
  getOrCreateUser, 
  addGoalMemory, 
  addRecentChat, 
  addImportantMemory,
  updateUserField, // 🆕 Import this new function
  updateChecklistStatus, // 🆕 Import this new function
  getChecklistByDate // 🆕 Import this new function
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
    
    // 🆕 START OF NEW CHECK-IN FEATURE LOGIC
    // Check if the user is in the middle of a check-in conversation
    if (user.stage === 'awaiting_checkin_response') {
      const today = new Date().toDateString();
      await updateChecklistStatus(user._id, today, true, userInput);
      await updateUserField(userId, { stage: 'onboarded' }); // Reset the stage
      await bot.sendMessage(chatId, "Got it! Your check-in has been recorded. Awesome job!");
      return; // End processing, as the message was a check-in report
    }
    
    // Handle the new `/checkin` command
    if (userInput.toLowerCase() === '/checkin') {
      const today = new Date().toDateString();
      const todayChecklist = await getChecklistByDate(user._id, today);
      
      if (!todayChecklist) {
        await bot.sendMessage(chatId, "You don't have a checklist for today yet. Set your goal first!");
        return;
      }
      if (todayChecklist.checkedIn) {
        await bot.sendMessage(chatId, "You've already checked in for today! You can only check in once per day.");
        return;
      }

      await updateUserField(userId, { stage: 'awaiting_checkin_response' });
      await bot.sendMessage(chatId, "Great! How did you do with your tasks today? Please provide a brief report on your progress.");
      return; // End processing to wait for user's report
    }
    // 🆕 END OF NEW CHECK-IN FEATURE LOGIC
    
    // --- Existing logic for /remember command ---
    if (userInput.startsWith('/remember')) {
      const textToRemember = userInput.replace('/remember', '').trim();
      if (textToRemember) {
        await addImportantMemory(user, textToRemember);
        await bot.sendMessage(chatId, "Got it. I've added that to your long-term memory.");
      } else {
        await bot.sendMessage(chatId, "What should I remember? Use the command like this: /remember [your important note]");
      }
      return;
    }
    
    // --- Existing AI-based conversation logic ---
    await addRecentChat(user, userInput);
    
    const StrictMode = user.missedCheckins >= 3;
    const { messages: aiReplyMessages, intent, goal } = await getSmartResponse(user, userInput, model, StrictMode);
    
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

    if (intent === 'create_checklist' && goal) {
      const goalSaved = await addGoalMemory(user, goal);
      if (goalSaved) {
        await bot.sendMessage(chatId, "I've saved your goal! I'll generate a daily checklist for you.");
      }
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
    
  } catch (error) {
    console.error("❌ Error handling message:", error);
    await bot.sendMessage(chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
};