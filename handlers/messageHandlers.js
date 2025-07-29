const TelegramBot = require('node-telegram-bot-api');
const { findOrCreateUser, updateUser, addDailyTasks } = require('../controllers/userController');
const getSmartResponse = require('../utils/getSmartResponse');
const { checkAccessLevel, incrementAIUsage, hasAccessToAI, canUseAI } = require('../utils/subscriptionUtils');
const generateChecklist = require('../utils/generateChecklist');
const generateWeeklyChecklist = require('../helpers/generateWeeklyChecklist');
const { getAIModelAndAccess } = require('../utils/subscriptionUtils');

module.exports = function (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const text = msg.text.trim();
    const today = new Date().toISOString().split('T')[0];
    const userId = msg.from.id;

    let user = await findOrCreateUser(telegramId);
    if (!user) return bot.sendMessage(chatId, '❌ Something went wrong creating your profile.');

    // Run onboarding flow if needed
    if (text === '/start') {
      if (!user.name) {
        user.stage = 'awaiting_name';
        await user.save();
        return bot.sendMessage(chatId, "👋 Welcome! What’s your name?");
      } else {
        return bot.sendMessage(chatId, "👋 Let’s get you started again...");
      }
    }

    // Onboarding stages
    if (user.stage === 'awaiting_name') {
      user.name = text;
      user.stage = 'awaiting_focus';
      await user.save();
      return bot.sendMessage(chatId, `Nice to meet you, ${user.name}! What’s your current focus?`);
    }

    if (user.stage === 'awaiting_focus') {
      user.focus = text;
      user.stage = 'completed_onboarding';
      await user.save();
      return bot.sendMessage(chatId, `Great! Your focus is set to: *${user.focus}*`, { parse_mode: 'Markdown' });
    }

    // After onboarding
    if (user.stage !== 'completed_onboarding') {
      await bot.sendMessage(chatId, 'Let’s get you started again...');
      return;
    }

    // AI access control
    const accessLevel = checkAccessLevel(user);
    const usingChecklistCommand = text.startsWith('/checklist') || text.includes('checklist');
    const usingGeneralSmartQuery = !['✅', '❌', '1', '2', '3'].includes(text);

    if (usingGeneralSmartQuery && accessLevel === 'none') {
      return bot.sendMessage(chatId, `🔒 You need to subscribe to use Focusly AI features.

Use the checklist manually or subscribe to unlock smart features.`);
    }

    if (usingGeneralSmartQuery && accessLevel === 'basic') {
      return bot.sendMessage(chatId, `🚫 Smart AI replies are only available for *Premium* users.

You can only use AI to generate checklists with the Basic plan.`, { parse_mode: 'Markdown' });
    }

    const accessCheck = await getAIModelAndAccess(user);
    if (usingGeneralSmartQuery && !accessCheck.allowed) {
      return bot.sendMessage(chatId, `🔒 ${accessCheck.reason}`);
    }

    if (usingGeneralSmartQuery && ['trial', 'premium'].includes(accessLevel)) {
      await incrementAIUsage(user);
      const smartReply = await getSmartResponse(text, user);
      return bot.sendMessage(chatId, smartReply || "🤖 Sorry, I couldn’t think of a smart reply right now.");
    }

    // Simple menu logic
    if (text === '1') {
      return bot.sendMessage(chatId, "📝 What are your tasks for today? Separate them with commas.");
    }
    if (text === '2') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yyyymmdd = yesterday.toISOString().split('T')[0];
      const yesterdayEntry = user.history?.find(h => h.date === yyyymmdd);
      if (yesterdayEntry) {
        return bot.sendMessage(chatId, `📆 *Yesterday’s Tasks:*
${yesterdayEntry.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`, { parse_mode: 'Markdown' });
      } else {
        return bot.sendMessage(chatId, `😕 I couldn’t find any tasks from yesterday.`);
      }
    }
    if (text === '3') {
      user.stage = 'awaiting_focus';
      await user.save();
      return bot.sendMessage(chatId, `What’s your new focus?`);
    }

    // Handle checklist input
    if (text.includes(',') && user.stage === 'completed_onboarding') {
      const tasks = text.split(',').map(t => t.trim()).filter(Boolean);
      await addDailyTasks(user, tasks);
      return bot.sendMessage(chatId, `✅ Got it! I’ve saved your tasks:
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);
    }

    // Fallback reply
    return bot.sendMessage(chatId, "🤖 I don’t understand that. Choose an option or ask something meaningful.");
  });
};
