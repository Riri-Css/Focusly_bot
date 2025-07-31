const { getSmartResponse } = require('../utils/getSmartResponse');
const { getUserByTelegramId, createOrUpdateUser } = require('../controllers/userController');
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
    // Ensure user exists
    let user = await getUserByTelegramId(userId);
    if (!user) {
      user = await createOrUpdateUser(userId, { telegramId: userId });
    }

    // Check AI access
    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
      await bot.sendMessage(chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
      return;
    }

    // Choose AI model
    const model = getModelForUser(user);
    if (!model) {
      await bot.sendMessage(chatId, "Your current plan doesn’t support AI access. Upgrade to continue.");
      return;
    }

    // Generate AI response
    const aiReplyRaw = await getSmartResponse(text, model);

    // Normalize the reply to a string
    const aiReplyString = Array.isArray(aiReplyRaw)
      ? aiReplyRaw.join('\n')
      : String(aiReplyRaw || '');

    if (!aiReplyString || aiReplyString.trim().length === 0) {
      console.error("⚠️ Invalid AI reply received:", aiReplyRaw);
      await bot.sendMessage(chatId, "The AI didn’t respond properly. Please try again.");
      return;
    }

    // Send parts of reply with delay
    const replyParts = aiReplyString.split('\n\n');
    for (const part of replyParts) {
      if (part.trim()) {
        await bot.sendMessage(chatId, part.trim());
        await delay(1000);
      }
    }

    // Track usage
    await trackAIUsage(user, 'general');

  } catch (error) {
    console.error("❌ Error handling message:", error);
    await bot.sendMessage(chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
};const { getSmartResponse } = require('../utils/getSmartResponse');
const { getUserByTelegramId, createOrUpdateUser } = require('../controllers/userController');
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
    // Ensure user exists
    let user = await getUserByTelegramId(userId);
    if (!user) {
      user = await createOrUpdateUser(userId, { telegramId: userId });
    }

    // Check AI access
    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
      await bot.sendMessage(chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
      return;
    }

    // Choose AI model
    const model = getModelForUser(user);
    if (!model) {
      await bot.sendMessage(chatId, "Your current plan doesn’t support AI access. Upgrade to continue.");
      return;
    }

    // Generate AI response
    const aiReplyRaw = await getSmartResponse(text, model);

    // Normalize the reply to a string
    const aiReplyString = Array.isArray(aiReplyRaw)
      ? aiReplyRaw.join('\n')
      : String(aiReplyRaw || '');

    if (!aiReplyString || aiReplyString.trim().length === 0) {
      console.error("⚠️ Invalid AI reply received:", aiReplyRaw);
      await bot.sendMessage(chatId, "The AI didn’t respond properly. Please try again.");
      return;
    }

    // Send parts of reply with delay
    const replyParts = aiReplyString.split('\n\n');
    for (const part of replyParts) {
      if (part.trim()) {
        await bot.sendMessage(chatId, part.trim());
        await delay(1000);
      }
    }

    // Track usage
    await trackAIUsage(user, 'general');

  } catch (error) {
    console.error("❌ Error handling message:", error);
    await bot.sendMessage(chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
};

