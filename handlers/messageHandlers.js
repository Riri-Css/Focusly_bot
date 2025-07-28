
const { checkAccess } = require('../utils/subscriptionUtils');
const { findOrCreateUser, updateUser, addDailyTasks } = require('../controllers/userController');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { analyzeChecklistIntent } = require('../Ai/intentAnalyzer');
const generateWeeklyChecklist = require('../helpers/generateWeeklyChecklist');
const User = require('../models/user');

module.exports = function (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const text = msg.text;
    const today = new Date().toISOString().split('T')[0];
    const userId = msg.from.id;

    let user = await findOrCreateUser(telegramId);
    if (!user) return bot.sendMessage(chatId, '❌ Something went wrong creating your profile.');

    // Trial + subscription check
    const hasAccess = await checkAccess(userId);
    if (!hasAccess) {
      return bot.sendMessage(chatId, `🔒 Your access has expired.

      Please subscribe to continue using Focusly:`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💳 Subscribe (Basic ₦1,000)', url: 'https://paystack.com/buy/focusly-basic' }],
            [{ text: '🚀 Go Premium (₦1,500)', url: 'https://paystack.com/buy/focusly-premium' }]
          ]
        }
      });
    }

    // Subscribe command
    if (/\/subscribe|subscribe/i.test(text)) {
      const paystackLink = `https://paystack.com/billingsubscription/PLN_udmx2iosxp2jsh0?reference=${telegramId}`;
      return bot.sendMessage(chatId, `💳 To continue using Focusly, subscribe here:
      [Click to Subscribe](${paystackLink})`, { parse_mode: 'Markdown' });
    }

    // /start onboarding handler
    if (text === '/start') {
      if (!user.name) {
        user.stage = 'awaiting_name';
        await user.save();
        return bot.sendMessage(chatId, "👋 Welcome! What’s your name?");
      } else {
          return bot.sendMessage(chatId, "👋 Let’s get you started again...");
        }
    }

    // Onboarding: name → focus → tasks
    if (user.stage === 'awaiting_name') {
      user.name = text;
      user.stage = 'awaiting_focus';
      await user.save();
      return bot.sendMessage(chatId, `Nice to meet you, ${user.name}! What’s your main focus or goal right now?`);
    }

    if (user.stage === 'awaiting_focus') {
      user.focus = text;
      user.stage = 'awaiting_tasks';
      await user.save();
      return bot.sendMessage(chatId, `Awesome! Your focus is now set to: *${user.focus}*

      Now tell me 1–3 tasks you’ll do today to support this. Separate them with commas.`, { parse_mode: 'Markdown' });
    }

    if (user.stage === 'awaiting_tasks') {
      const tasks = text.split(',').map(t => t.trim()).filter(t => t.length > 0);
      if (tasks.length === 0) {
        return bot.sendMessage(chatId, 'Please send at least one task, separated by commas.');
      }
      await addDailyTasks(user, tasks);
      user.stage = 'completed_onboarding';
      await user.save();
      return bot.sendMessage(chatId, `✅ Got it! You’ve planned ${tasks.length} task(s) for today. Let’s go! 💪`);
    }

    // Check if message is a checklist
    const checklistAnalysis = await analyzeChecklistIntent(text);
    if (checklistAnalysis?.isChecklist) {
      user.manualChecklist = checklistAnalysis.items;
      await user.save();
      await bot.sendMessage(chatId, `✅ Got your checklist:
        ${checklistAnalysis.items.map((item, i) => `${i + 1}. ${item}`).join('')}
      `);
      return;
    }

    // Check-in logic
    if (user.stage === 'completed_onboarding' && (text === '✅' || text === '❌')) {
      if (user.lastCheckInDate === today) {
        return bot.sendMessage(chatId, '⏳ You’ve already checked in today! Come back tomorrow.');
      }

      user.lastCheckInDate = today;
      user.hasCheckedInToday = true;

      if (text === '✅') {
        user.streak += 1;
        user.stage = 'awaiting_positive_reflection';
        await user.save();
        await bot.sendMessage(chatId, '💬 What helped you stay focused today?');
        return;
      } else {
        user.streak = 0;
        user.stage = 'awaiting_negative_reflection';
        await user.save();
        await bot.sendMessage(chatId, '💡 What got in the way today? Let’s be honest.');
        return;
      }
    }

    // Reflection response
    if (user.stage === 'awaiting_positive_reflection' || user.stage === 'awaiting_negative_reflection') {
      user.stage = 'completed_onboarding';
      await user.save();
      return bot.sendMessage(chatId, 'Thanks for reflecting. Let’s keep going 🚀');
    }

    // Default fallback (OpenAI smart response if possible)
    try {
      const aiReply = await getSmartResponse(text, user);
      return bot.sendMessage(chatId, aiReply);
    } catch (err) {
      console.error("Smart response error:", err.message);
      return bot.sendMessage(chatId, "Sorry, I couldn’t think of a smart reply right now.");
    }
  });
};
