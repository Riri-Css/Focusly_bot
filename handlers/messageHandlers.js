const User = require('../models/user');
const getSmartResponse = require('../utils/getSmartResponse');
const { checkAIEligibility, getModelForUser } = require('../utils/subscriptionUtils');
const { updateUserAIUsage } = require('../controllers/userController');
const generateChecklist = require('../helpers/generateChecklist');
const generateWeeklyChecklist = require('../helpers/generateWeeklyChecklist');


const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const message = msg.text?.trim();

  try {
    let user = await User.findOne({ telegramId: chatId });
    if (!user) {
      user = await User.create({
        telegramId: chatId,
        onboardingStep: 0,
        streak: 0,
        trialStartDate: new Date(),
        aiUsage: [],
      });
      await bot.sendMessage(chatId, '👋 Welcome to Focusly! Let’s get started. What’s your current goal or focus?');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const isCheckInTime = message === '✅' || message === '❌';

    // Handle onboarding flow
    if (user.onboardingStep >= 0 && user.onboardingStep < 3) {
      if (user.onboardingStep === 0) {
        user.focus = message;
        user.onboardingStep++;
        await bot.sendMessage(chatId, '🔥 Great! What tasks will help you achieve this focus today?');
      } else if (user.onboardingStep === 1) {
        user.tasks = message.split(',').map(t => t.trim());
        user.onboardingStep++;
        await bot.sendMessage(chatId, '⏰ What time should I remind you to check in? (e.g., 9 PM)');
      } else if (user.onboardingStep === 2) {
        user.reminderTime = message;
        user.onboardingStep++;
        user.lastCheckInDate = null;
        await bot.sendMessage(chatId, '✅ All set! I’ll remind you daily to check in.');
      }
      await user.save();
      return;
    }

    // Handle daily check-in
    if (isCheckInTime) {
      if (user.lastCheckInDate === today) {
        await bot.sendMessage(chatId, '✅ You’ve already checked in today!');
        return;
      }

      if (message === '✅') {
        user.streak = (user.streak || 0) + 1;
        await bot.sendMessage(chatId, `🔥 Nice! Streak: ${user.streak} day(s)!`);
      } else {
        user.streak = 0;
        await bot.sendMessage(chatId, `❌ No worries. Let's restart tomorrow stronger.`);
      }

      user.lastCheckInDate = today;
      await user.save();
      return;
    }

    // AI smart general response (e.g., "hi", "how are you")
    const smartTriggers = ['hi', 'hello', 'hey', 'how are you', 'sup', 'yo'];
    const lowerMessage = message.toLowerCase();
    const isSmartMessage = smartTriggers.some(trigger => lowerMessage.includes(trigger));

    if (isSmartMessage) {
      try {
        const { allowed, reason } = await checkAIEligibility(user);
        if (!allowed) {
          await bot.sendMessage(chatId, `⚠️ ${reason}`);
          return;
        }

        const model = getModelForUser(user);
        const aiReply = await getSmartResponse(message, model);
        await bot.sendMessage(chatId, aiReply);

        await updateUserAIUsage(user.telegramId, 'daily');
        return;
      } catch (err) {
        console.error('⚠️ AI failed:', err.message);
        await bot.sendMessage(chatId, `🤖 Sorry, I couldn’t generate a smart reply right now.`);
        return;
      }
    }

    // Commands or checklist generation
    if (lowerMessage.includes('checklist')) {
      try {
        const { allowed, reason } = await checkAIEligibility(user);
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
        console.error('⚠️ Checklist generation failed:', err.message);
        await bot.sendMessage(chatId, `🚧 Sorry, I couldn't generate a checklist right now.`);
        return;
      }
    }

    // Fallback: AI-enhanced reply or default
    try {
      const { allowed } = await checkAIEligibility(user);
      if (allowed) {
        const model = getModelForUser(user);
        const reply = await getSmartResponse(message, model);
        await bot.sendMessage(chatId, reply);
        await updateUserAIUsage(user.telegramId, 'daily');
      } else {
        await bot.sendMessage(chatId, `🤔 I'm not sure how to respond to that. Want to check in or set a goal?`);
      }
    } catch (err) {
      console.error('⚠️ Fallback failed:', err.message);
      await bot.sendMessage(chatId, `🙈 I ran into an issue responding. Try again later.`);
    }
  } catch (error) {
    console.error('❌ Error handling message:', error.message);
  }
};

module.exports = { handleMessage };
