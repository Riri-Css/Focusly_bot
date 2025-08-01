const { getSmartResponse } = require('../utils/getSmartResponse');
const { getUserByTelegramId, getOrCreateUser, updateUserField } = require('../controllers/userController');
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
  const text = msg.text?.trim();

  if (!text) {
    await bot.sendMessage(chatId, "Hmm, I didn’t catch that. Try sending it again.");
    return;
  }

  try {
    let user = await getUserByTelegramId(userId);
    if (!user) {
      user = await getOrCreateUser(userId);
    }

    // 🧠 Anti-repetition logic
    const now = new Date();
    const lastInteraction = user.lastInteraction || new Date(0);
    const timeSinceLast = (now - new Date(lastInteraction)) / 1000;

    // Optional: If the user just interacted in < 90 seconds and AI already replied
    if (timeSinceLast < 90 && user.lastAIQuestion === text) {
      await bot.sendMessage(chatId, "Looks like you just answered that! Let’s move forward.");
      return;
    }

    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
      await bot.sendMessage(chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
      return;
    }

    const model = getModelForUser(user);
    if (!model) {
      await bot.sendMessage(chatId, "Your current plan doesn’t support AI access. Upgrade to continue.");
      return;
    }

    const aiResponse = await getSmartResponse(text, model, user); // Now passes user memory
    let replyMessages = [];

    if (Array.isArray(aiResponse)) {
      replyMessages = aiResponse;
    } else if (typeof aiResponse === 'string') {
      replyMessages = [aiResponse];
    } else if (typeof aiResponse === 'object' && aiResponse.messages) {
      replyMessages = aiResponse.messages;
    } else {
      console.error("⚠️ Unexpected AI reply type:", typeof aiResponse, aiResponse);
      await bot.sendMessage(chatId, "The AI didn’t respond properly. Please try again.");
      return;
    }

    if (!replyMessages.length || !replyMessages.some(m => m.trim())) {
      console.error("⚠️ Empty AI reply:", aiResponse);
      await bot.sendMessage(chatId, "The AI didn’t return anything useful. Try rephrasing your message.");
      return;
    }

    for (const part of replyMessages) {
      if (part.trim()) {
        await bot.sendMessage(chatId, part.trim());
        await delay(1000);
      }
    }

    await trackAIUsage(user, 'general');

    // ✅ Update interaction memory
    await updateUserField(userId, {
      lastInteraction: new Date(),
      lastAIQuestion: text,
    });

  } catch (error) {
    console.error("❌ Error handling message:", error);
    await bot.sendMessage(chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
};
