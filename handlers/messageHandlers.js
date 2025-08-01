const { getSmartResponse } = require('../utils/getSmartResponse');
const { generateChecklist } = require('../utils/generateChecklist');
const { generateWeeklyChecklist } = require('../helpers/generateWeeklyChecklist');
const { updateUserAIUsage, getUserByTelegramId } = require('../controllers/userController');
const { hasAIUsage, getModelForUser } = require('../utils/subscriptionUtils');
const User = require('./models/user');

async function handleMessage(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text) return;

  const user = await getUserByTelegramId(chatId);
  if (!user) {
    await bot.sendMessage(chatId, "Please restart the bot using /start.");
    return;
  }

  const model = getModelForUser(user);
  const hasAccess = hasAIUsage(user);

  if (!hasAccess) {
    await bot.sendMessage(chatId, "🛑 You’ve reached your AI usage limit or your subscription has expired.");
    return;
  }

  const aiResponse = await getSmartResponse(text, model, user);
  const { messages, intent, goal, duration, timelineFlag } = aiResponse;

  // Track AI usage if intent uses GPT
  if (intent !== 'error') {
    await updateUserAIUsage(user, intent);
  }

  if (intent === 'create_checklist' && goal && duration) {
    const checklistMessages = await generateChecklist(goal, duration, model);
    for (const line of checklistMessages) {
      await bot.sendMessage(chatId, line);
    }
    // Update memory
    user.lastGoal = goal;
    user.lastDuration = duration;
    await user.save();
    return;
  }

  if (intent === 'career_recommendation') {
    const careerTips = [
      "🧭 Let’s figure this out. What are 3 things you enjoy doing *without* being paid?",
      "💼 Think about problems you enjoy solving. That’s often a clue.",
      "🎯 Want help deciding? Try saying: “I’m good at X but scared to pursue it.”"
    ];
    for (const tip of careerTips) {
      await bot.sendMessage(chatId, tip);
    }
    return;
  }

  // General AI response (e.g. "hi", "I'm overwhelmed", etc.)
  for (const line of messages) {
    await bot.sendMessage(chatId, line);
  }

  // Update memory if goal or duration changed
  if (goal) user.lastGoal = goal;
  if (duration) user.lastDuration = duration;
  await user.save();
}

module.exports = {
  getSmartResponse,
  handleMessage,
};
