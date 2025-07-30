const { findOrCreateUser, updateUser, addDailyTasks } = require('../controllers/userController');
const getSmartResponse = require('../utils/getSmartResponse');
const { checkAccessLevel, incrementUsage, getAIModelAndAccess } = require('../utils/subscriptionUtils');
const generateChecklist = require('../utils/generateChecklist');
const generateWeeklyChecklist = require('../helpers/generateWeeklyChecklist');

module.exports = function (bot) {
  bot.on('message', async (msg) => {
  if (msg.text === 'ping') {
    return bot.sendMessage(chatId, 'pong, Bot is alive');
  }
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const text = msg.text?.trim();
    const today = new Date().toISOString().split('T')[0];

    let user = await findOrCreateUser(telegramId);
    if (!user) return bot.sendMessage(chatId, '❌ Something went wrong creating your profile.');

    if (!text) return;

    // /start command
    if (text === '/start') {
      if (!user.name) {
        user.stage = 'awaiting_name';
        await user.save();
        return bot.sendMessage(chatId, "👋 Welcome! What’s your name?");
      } else {
        return bot.sendMessage(chatId, "👋 Let’s get you started again...");
      }
    }

    // Onboarding flow
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

    if (user.stage !== 'completed_onboarding') {
      return bot.sendMessage(chatId, 'Let’s get you started again...');
    }

    // ✅ AI access logic
    const isSmartQuery = !['✅', '❌', '1', '2', '3'].includes(text);
    if (isSmartQuery) {
      const { allowed, reason } = await getAIModelAndAccess(user);
      if (!allowed) return bot.sendMessage(chatId, `🔒 ${reason}`);

      if (user.subscriptionPlan === 'basic' && !text.toLowerCase().includes('checklist')) {
        return bot.sendMessage(chatId, `🚫 Smart AI replies are only available for *Premium* users.\n\nYou can only use AI to generate checklists with the Basic plan.`, { parse_mode: 'Markdown' });
      }

      await incrementUsage(user.telegramId);
      const smartReply = await getSmartResponse(user, text);
      return bot.sendMessage(chatId, smartReply || "🤖 I couldn’t think of a smart reply.");
    }

    // Menu options
    if (text === '1') {
      return bot.sendMessage(chatId, "📝 What are your tasks for today? Separate them with commas.");
    }
    if (text === '2') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yyyymmdd = yesterday.toISOString().split('T')[0];
      const yesterdayEntry = user.history?.find(h => h.date === yyyymmdd);
      if (yesterdayEntry) {
        return bot.sendMessage(chatId, `📆 *Yesterday’s Tasks:*\n${yesterdayEntry.tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`, { parse_mode: 'Markdown' });
      } else {
        return bot.sendMessage(chatId, `😕 I couldn’t find any tasks from yesterday.`);
      }
    }
    if (text === '3') {
      user.stage = 'awaiting_focus';
      await user.save();
      return bot.sendMessage(chatId, `What’s your new focus?`);
    }

    if (text.includes(',') && user.stage === 'completed_onboarding') {
      const tasks = text.split(',').map(t => t.trim()).filter(Boolean);
      await addDailyTasks(user, tasks);
      return bot.sendMessage(chatId, `✅ Got it! I’ve saved your tasks:\n${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);
    }

    return bot.sendMessage(chatId, "🤖 I don’t understand that. Choose an option or ask something meaningful.");
  });
};
module.exports = function (bot) {
  bot.on('message', async (msg) => {
    
  });
};
