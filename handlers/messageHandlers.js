const { getSmartResponse } = require('../utils/getSmartResponse');
const { getUserByTelegramId, createOrUpdateUser } = require('../controllers/userController');
const { hasAIUsageAccess, trackAIUsage, getModelForUser } = require('../utils/subscriptionUtils');

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
    // Ensure user exists
    const user = await getUserByTelegramId(userId) || await createOrUpdateUser(userId, { telegramId: userId });

    // Check if AI access is allowed
    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
      await bot.sendMessage(chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
      return;
    }

    // Get model (based on plan or trial)
    const model = await getModelForUser(user);

    // Get smart response from AI
    const aiReply = await getSmartResponse(text, model);

    // Send reply with delay if multiple parts
    const replyParts = aiReply.split('\n\n');
    for (const part of replyParts) {
      await bot.sendMessage(chatId, part.trim());
      await delay(1000); // 1 second pause between parts
    }

    // Track usage
    await trackAIUsage(user, 'smart');

  } catch (error) {
    console.error("❌ Error handling message:", error);
    await bot.sendMessage(chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
};
