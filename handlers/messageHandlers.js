const User = require('../models/user');
const { getSmartResponse } = require('../utils/getSmartResponse');
const {
  hasAIUsageAccess,
  trackAIUsage,
  getModelForUser,
} = require('../utils/subscriptionUtils');
const {
  getUserByTelegramId,
  getOrCreateUser,
  updateUserAIUsage,
} = require('../controllers/userController');
const generateChecklist = require('../utils/generateChecklist');
const generateWeeklyChecklist = require('../helpers/generateWeeklyChecklist');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const handleMessage = async (bot, msg) => {
  if (!msg || !msg.from || !msg.from.id) {
    console.error("❌ Invalid message format received:", msg);
    return;
  }

  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const text = msg.text?.trim();
  const today = new Date().toISOString().split('T')[0];

  if (!text) {
    await bot.sendMessage(chatId, "Hmm, I didn’t catch that. Try sending it again.");
    return;
  }

  try {
    let user = await getUserByTelegramId(telegramId);
    if (!user) {
      user = await getOrCreateUser(telegramId);
      await bot.sendMessage(chatId, '👋 Welcome to Focusly! Let’s get started. What’s your current goal or focus?');
      return;
    }

    // ========== ONBOARDING ==========
    if (user.onboardingStep >= 0 && user.onboardingStep < 3) {
      try {
        if (user.onboardingStep === 0) {
          user.focus = text;
          user.onboardingStep++;
          await bot.sendMessage(chatId, '🔥 Great! What tasks will help you achieve this focus today?');
        } else if (user.onboardingStep === 1) {
          user.tasks = text.split(',').map(t => t.trim());
          user.onboardingStep++;
          await bot.sendMessage(chatId, '⏰ What time should I remind you to check in? (e.g., 9 PM)');
        } else if (user.onboardingStep === 2) {
          user.reminderTime = text;
          user.onboardingStep++;
          user.lastCheckInDate = null;
          await bot.sendMessage(chatId, '✅ All set! I’ll remind you daily to check in.');
        }
        await user.save();
        return;
      } catch (err) {
        console.error("❌ Onboarding failed:", err);
        await bot.sendMessage(chatId, "Something went wrong during onboarding. Please try again.");
        return;
      }
    }

    // ========== DAILY CHECK-IN ==========
    if (text === '✅' || text === '❌') {
      try {
        if (user.lastCheckInDate === today) {
          await bot.sendMessage(chatId, '✅ You’ve already checked in today!');
          return;
        }

        if (text === '✅') {
          user.streak = (user.streak || 0) + 1;
          await bot.sendMessage(chatId, `🔥 Nice! Streak: ${user.streak} day(s)!`);
        } else {
          user.streak = 0;
          await bot.sendMessage(chatId, `❌ No worries. Let's restart tomorrow stronger.`);
        }

        user.lastCheckInDate = today;
        await user.save();
        return;
      } catch (err) {
        console.error("❌ Check-in failed:", err);
        await bot.sendMessage(chatId, "Something went wrong while checking in. Please try again.");
        return;
      }
    }

    const lowerMessage = text.toLowerCase();

    // ========== CHECKLIST GENERATION ==========
    if (lowerMessage.includes('checklist')) {
      try {
        const { allowed, reason } = await hasAIUsageAccess(user);
        if (!allowed) {
          await bot.sendMessage(chatId, `⚠️ ${reason}`);
          return;
        }

        const model = getModelForUser(user);
        const checklist = await generateChecklist(user, model);
        await bot.sendMessage(chatId, `📝 Here's your checklist:\n\n${checklist}`);
        await updateUserAIUsage(user.telegramId, 'weekly');
        return;
      } catch (err) {
        console.error("❌ Checklist generation failed:", err);
        await bot.sendMessage(chatId, "🚧 Sorry, I couldn't generate a checklist right now.");
        return;
      }
    }

    // ========== GENERAL SMART AI REPLY ==========
    const smartTriggers = ['hi', 'hello', 'hey', 'how are you', 'sup', 'yo'];
    const isSmartMessage = smartTriggers.some(trigger => lowerMessage.includes(trigger));

    if (isSmartMessage || text.length < 80) {
      try {
        const { allowed, reason } = await hasAIUsageAccess(user);
        if (!allowed) {
          await bot.sendMessage(chatId, `⚠️ ${reason}`);
          return;
        }

        const model = getModelForUser(user);
        const aiReplyRaw = await getSmartResponse(text, model);

        let aiReply = '';
        if (Array.isArray(aiReplyRaw)) {
          aiReply = aiReplyRaw.filter(r => typeof r === 'string').join('\n\n');
        } else if (typeof aiReplyRaw === 'string') {
          aiReply = aiReplyRaw;
        } else {
          console.error("⚠️ Unexpected AI reply type:", typeof aiReplyRaw, aiReplyRaw);
          await bot.sendMessage(chatId, "The AI didn’t respond properly. Please try again.");
          return;
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

        await updateUserAIUsage(user.telegramId, 'daily');
        return;
      } catch (err) {
        console.error("❌ AI smart response failed:", err);
        await bot.sendMessage(chatId, "🤖 Sorry, I couldn’t generate a smart reply right now.");
        return;
      }
    }

    // ========== FALLBACK ==========
    await bot.sendMessage(chatId, "🤔 I’m not sure how to respond to that. Try rephrasing or type 'checklist' for help.");

  } catch (error) {
    console.error("❌ Error in handleMessage:", error);
    await bot.sendMessage(chatId, "Something went wrong. Please try again later.");
  }
};

module.exports = {
  handleMessage,
};
