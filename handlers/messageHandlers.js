const {
  getOrCreateUser, updateUserField, incrementStreak, resetStreak,
  getTodayTasks, markTaskStatus, checkTaskStatus,
  incrementAIUsage, getAIUsage, saveDailyTasks
} = require('../controllers/userController');
const {
  checkSubscriptionStatus, getRemainingAIQuota, getModelForUser
} = require('../utils/subscriptionUtils');
const generateChecklist = require('../utils/generateChecklist');
const { getSmartResponse } = require('../utils/getSmartResponse');

async function handleMessage(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  const telegramId = msg.from.id;

  if (!text) return;

  const user = await getOrCreateUser(telegramId);
  if (!user) {
    await bot.sendMessage(chatId, "Something went wrong. Please try again.");
    return;
  }

  const lowerText = text.toLowerCase();

  // === 1. ONBOARDING ===
  if (!user.goal) {
    await updateUserField(telegramId, 'goal', text);
    await bot.sendMessage(chatId, `Nice! So your focus is: *${text}*. Let's stay consistent.`, { parse_mode: 'Markdown' });

    const defaultTasks = [`Work on ${text}`, `Avoid distractions`, `Review progress`, `Learn something new`, `Stay focused`];
    await saveDailyTasks(telegramId, defaultTasks);

    await bot.sendMessage(chatId, "Here’s a smart daily checklist for today:");
    for (const task of defaultTasks) {
      await bot.sendMessage(chatId, `▫️ ${task}`);
    }

    return;
  }

  // === 2. CHECK-IN ===
  if (lowerText === '✅' || lowerText === '❌') {
    const status = lowerText === '✅' ? 'completed' : 'skipped';
    await markTaskStatus(telegramId, status);

    if (status === 'completed') {
      await incrementStreak(telegramId);
      await bot.sendMessage(chatId, "🔥 Great job staying focused today! +1 streak!");
    } else {
      await resetStreak(telegramId);
      await bot.sendMessage(chatId, "😕 You skipped your tasks today. Streak reset. Let’s bounce back tomorrow.");
    }

    return;
  }

  // === 3. USER ASKS FOR CHECKLIST ===
  if (lowerText.includes('checklist')) {
    try {
      const subscription = await checkSubscriptionStatus(telegramId);
      if (subscription.status === 'none') {
        await bot.sendMessage(chatId, "🚫 You need a subscription to use the AI checklist. Start your free trial or subscribe to unlock.");
        return;
      }

      const quotaLeft = await getRemainingAIQuota(telegramId);
      if (quotaLeft <= 0) {
        await bot.sendMessage(chatId, "⚠️ You've reached your AI usage limit. Upgrade to Premium for unlimited access.");
        return;
      }

      const model = getModelForUser(subscription.plan);
      const checklist = await generateChecklist(user.goal, model);

      await incrementAIUsage(telegramId);
      await saveDailyTasks(telegramId, checklist);

      await bot.sendMessage(chatId, "📋 Here’s your smart checklist:");
      for (const item of checklist) {
        await bot.sendMessage(chatId, `▫️ ${item}`);
      }
    } catch (error) {
      console.error("Error generating checklist:", error);
      await bot.sendMessage(chatId, "⚠️ Couldn't generate checklist right now. Try again later.");
    }

    return;
  }

  // === 4. GENERAL AI MESSAGES ===
  try {
    const subscription = await checkSubscriptionStatus(telegramId);
    if (subscription.status === 'none') {
      await bot.sendMessage(chatId, "👋 You can chat with me freely after starting your 14-day free trial.");
      return;
    }

    const quotaLeft = await getRemainingAIQuota(telegramId);
    if (quotaLeft <= 0) {
      await bot.sendMessage(chatId, "⛔ You've used up your AI access for now. Consider upgrading to Premium.");
      return;
    }

    const model = getModelForUser(subscription.plan);
    const reply = await getSmartResponse(text, model); // ✅ Corrected order here

    if (reply) {
      await bot.sendMessage(chatId, reply);
      await incrementAIUsage(telegramId);
    } else {
      await bot.sendMessage(chatId, "🤔 I’m not sure how to respond. Try asking something else!");
    }
  } catch (err) {
    console.error("Error in general AI chat:", err);
    await bot.sendMessage(chatId, "⚠️ Something went wrong. Please try again later.");
  }
}

module.exports = { handleMessage };
