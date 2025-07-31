const User = require('../models/user');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { generateChecklist } = require('../utils/generateChecklist');
const { generateWeeklyChecklist } = require('../helpers/generateWeeklyChecklist');
const { updateUserUsageAndModel, hasAccessToAI } = require('../utils/subscriptionUtils');

async function handleMessage(msg, bot) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  let user = await User.findOne({ telegramId: chatId });

  if (!user) {
    user = new User({
      telegramId: chatId,
      onboardingStep: 'goal',
      streak: 0,
      createdAt: new Date(),
      trialStartDate: new Date(),
      isTrial: true,
      subscriptionStatus: 'trial',
    });
    await user.save();

    return bot.sendMessage(chatId, "👋 Hi! Welcome to Focusly.\n\nWhat’s one goal you’d like to stay focused on this week?");
  }

  // Onboarding: Step 1 – Set Focus
  if (!user.focus && user.onboardingStep === 'goal') {
    user.focus = text;
    user.onboardingStep = 'tasks';
    await user.save();

    return bot.sendMessage(chatId, `Great! Your focus is: *${text}*\n\nNow send me 2–5 specific tasks you’ll do to achieve this goal today.`, { parse_mode: 'Markdown' });
  }

  // Onboarding: Step 2 – Set Tasks
  if (user.focus && !user.tasks.length && user.onboardingStep === 'tasks') {
    const tasks = text.split('\n').filter(Boolean);
    if (tasks.length < 1) {
      return bot.sendMessage(chatId, '❗ Please send at least 2 tasks for today. One per line.');
    }

    user.tasks = tasks.slice(0, 5);
    user.checkInCompleted = false;
    user.dailyReflection = '';
    user.onboardingStep = 'done';
    user.lastCheckInDate = new Date();
    await user.save();

    return bot.sendMessage(chatId, `✅ Got it!\n\nI'll check in with you at 9 PM to see how it went. Stay focused!\n\nYour tasks:\n${user.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);
  }

  // Daily check-in (✅ / ❌ response)
  const lowered = text.toLowerCase();
  const isToday = user.lastCheckInDate?.toDateString() === new Date().toDateString();
  if (!user.checkInCompleted && isToday && (lowered === '✅' || lowered === '❌')) {
    user.checkInCompleted = true;

    if (lowered === '✅') {
      user.streak += 1;
      user.dailyReflection = '';
      await user.save();

      let celebration = '';
      if (user.streak > 0 && user.streak % 3 === 0) {
        celebration = `🎉 You're on a ${user.streak}-day streak! Keep crushing it!`;
      }

      return bot.sendMessage(chatId, `Awesome job checking in today! ✅\n${celebration}`);
    } else {
      user.streak = 0;
      user.dailyReflection = '';
      await user.save();

      return bot.sendMessage(chatId, `Thanks for checking in. ❌\nLet's figure out what went wrong and do better tomorrow.`);
    }
  }

  // Daily Reflection
  if (user.checkInCompleted && isToday && !user.dailyReflection) {
    user.dailyReflection = text;
    await user.save();
    return bot.sendMessage(chatId, '📝 Thanks for sharing. Your reflection has been saved.');
  }

  // If user asks for a new checklist
  if (lowered.includes('checklist') || lowered.includes('plan') || lowered.includes('what should I do')) {
    const hasAccess = await hasAccessToAI(user);
    if (!hasAccess) return bot.sendMessage(chatId, "⚠️ You’ve reached your AI usage limit. Upgrade your plan to get more access.");

    const checklist = await generateChecklist(user);
    await updateUserUsageAndModel(user);
    return bot.sendMessage(chatId, `🧠 Here's a fresh checklist to help with your focus:\n\n${checklist}`);
  }

  // If user asks for weekly checklist
  if (lowered.includes('weekly')) {
    const hasAccess = await hasAccessToAI(user);
    if (!hasAccess) return bot.sendMessage(chatId, "⚠️ You’ve reached your AI usage limit. Upgrade your plan to get more access.");

    const weeklyChecklist = await generateWeeklyChecklist(user);
    await updateUserUsageAndModel(user);
    return bot.sendMessage(chatId, `📅 Here's your weekly action plan:\n\n${weeklyChecklist}`);
  }

  // Smart AI response for general input
  const hasAccess = await hasAccessToAI(user);
  if (!hasAccess) return bot.sendMessage(chatId, "⚠️ You’ve reached your AI usage limit. Upgrade your plan to get more access.");

  const smartReply = await getSmartResponse(user, text);
  await updateUserUsageAndModel(user);
  return bot.sendMessage(chatId, smartReply);
}

module.exports = {
  handleMessage,
};
