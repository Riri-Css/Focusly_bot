const { checkAccess } = require('../utils/subscriptionUtils');
const { findOrCreateUser, updateUser, addDailyTasks } = require('../controllers/userController');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { analyzeChecklistIntent } = require('../Ai/intentAnalyzer');
const generateWeeklyChecklist = require('../helpers/generateWeeklyChecklist');
const User = require('../models/user');
const axios = require('axios');
const checkSubscriptionStatus = require('../helpers/checkSubscriptionStatus');

module.exports = function (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id.toString();
    const text = msg.text;
    const today = new Date().toISOString().split('T')[0];

    const user = await findOrCreateUser(telegramId);

    // 🛡️ Trial expiration middleware
    const now = new Date();
    const trialStart = new Date(user.subscription?.trialStartDate || user.createdAt);
    const trialDays = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
    const isTrialExpired = trialDays > 14;
    const isSubscribed = user.subscription?.isActive && user.subscription?.hasPaid;
    const userId = msg.from.id;
    if (!(await checkAccess(userId))) {

  await bot.sendMessage(chatId, `🔒 Your access has expired.\n\nPlease subscribe to continue using Focusly:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Subscribe (Basic ₦1,000)', url: 'https://paystack.com/buy/focusly-basic' }],
        [{ text: '🚀 Go Premium (₦1,500)', url: 'https://paystack.com/buy/focusly-premium' }]
      ]
    }
  });
  return;
}
    // If trial expired and not subscribed, block access
    if (isTrialExpired && !isSubscribed) {
      if (!/\/start|\/subscribe|subscribe|pricing/i.test(text)) {
        return bot.sendMessage(chatId, `🚫 Your 14-day free trial has ended.\n\nTo keep using Focusly and maintain your streak, please subscribe by sending /subscribe or typing "subscribe".`);
      }
    }
    
    // 💳 Handle /subscribe command
    if (/\/subscribe|subscribe/i.test(text)) {
      const paystackLink = `https://paystack.com/billingsubscription/PLN_udmx2iosxp2jsh0?reference=${telegramId}`;
      return bot.sendMessage(chatId, `💳 To continue using Focusly, subscribe below:\n\n👉 [Click here to subscribe](<${paystackLink}>)\n\nYour subscription auto-renews monthly.`, { parse_mode: 'Markdown' });
    }
    // Grant access manually — only admin can use this
if (text.startsWith('/grantaccess')) {
  const adminId = process.env.ADMIN_ID; // We'll set this in .env

  if (msg.from.id.toString() !== adminId) {
    return bot.sendMessage(chatId, "⛔ You are not authorized to use this command.");
  }

  const parts = text.split(' ');
  if (parts.length < 2) {
    return bot.sendMessage(chatId, "❗ Usage: /grantaccess <@username or userID>");
  }

  const identifier = parts[1].replace('@', '').trim();

  // Try to find user by username or Telegram ID
  let user;
  if (!isNaN(identifier)) {
    user = await User.findOne({ telegramId: identifier });
  } else {
    user = await User.findOne({ username: identifier });
  }

  if (!user) {
    return bot.sendMessage(chatId, `⚠️ User "${identifier}" not found.`);
  }

  user.isSubscribed = true;
  user.subscriptionEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
  await user.save();

  return bot.sendMessage(chatId, `✅ Access granted to ${identifier} until ${user.subscriptionEnds.toDateString()}`);
}

// 📝 Handle checklist analysis
const checklistAnalysis = await analyzeChecklistIntent(text);

    try {
      // ✅ Progress history check
      if (/\/history|my progress|past tasks/i.test(text)) {
        const user = await User.findOne({ telegramId: chatId });

        if (!user?.history || user.history.length === 0) {
          return bot.sendMessage(chatId, `😕 No progress history found yet. Start checking in daily to build your record!`);
        }

        const recent = user.history.slice(-7).reverse().map(entry => {
          return `📅 ${entry.date}\n🎯 Focus: ${entry.focus}\n✅ Checked in: ${entry.checkedIn ? 'Yes' : 'No'}\n📋 Tasks: ${entry.tasks.join(', ')}`;
        }).join('\n\n');

        return bot.sendMessage(chatId, `📈 *Your Last 7 Days Progress:*\n\n${recent}`, { parse_mode: 'Markdown' });
      }

      // START command (optional external trigger)
      if (text === '/start') {
        await bot.sendMessage(chatId, 'Hi! What’s your name?');
        user.stage = 'awaiting_name';
        await user.save();
        return;
      }

      // Onboarding: Name → Focus → Tasks
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

        const aiReply = await getSmartResponse(user, `I just committed to this focus: ${user.focus}`, 'onboarding_boost');
        await bot.sendMessage(chatId, aiReply);

        return bot.sendMessage(chatId, `Awesome! Your focus is now set to: *${user.focus}*\n\nNow, tell me 1–3 tasks you'll do today to support this focus. Separate them with commas.`, { parse_mode: 'Markdown' });
      }

      // Checklist detection
      if (checklistAnalysis?.isChecklist) {
        user.manualChecklist = checklistAnalysis.items;
        await user.save();

        await bot.sendMessage(chatId, `✅ Got your checklist! Here's what I saved:\n\n` +
          checklistAnalysis.items.map((item, i) => `${i + 1}. ${item}`).join('\n'));
        return;
      }

      // Tasks entry
      if (user.stage === 'awaiting_tasks') {
        const tasks = text.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (tasks.length === 0) {
          return bot.sendMessage(chatId, 'Please send at least one task, separated by commas if there’s more.');
        }

        await addDailyTasks(user, tasks);
        user.stage = 'completed_onboarding';
        await user.save();

        await bot.sendMessage(chatId, `✅ Got it! You've planned ${tasks.length} task${tasks.length > 1 ? 's' : ''} for today. Let’s stay consistent! 💪`);

        // 2-hour reminder
        setTimeout(async () => {
          if (!user.hasCheckedInToday) {
            try {
              await bot.sendMessage(chatId, `👀 Just checking in! You mentioned your goal is *${user.focus}*. Have you made progress on your tasks yet?`, { parse_mode: 'Markdown' });
            } catch (error) {
              console.error('Failed to send 2-hour reminder:', error);
            }
          }
        }, 2 * 60 * 60 * 1000);

        return;
      }

      // Checklist generator fallback (if onboarding is done)
      if (user.stage === 'completed_onboarding' && (!user.weeklyChecklist || user.weeklyChecklist.length === 0)) {
        if (user.manualChecklist && user.manualChecklist.length > 0) {
          user.weeklyChecklist = user.manualChecklist;
          user.dailyChecklist = [user.manualChecklist[0]];
          user.currentChecklistDay = 1;
          await user.save();

          await bot.sendMessage(chatId, `✅ Using your custom checklist!\n\nHere's your task for today:\n${user.manualChecklist[0]}`);
        } else {
          const checklist = await generateWeeklyChecklist(user.focus);
          user.weeklyChecklist = checklist;
          user.dailyChecklist = [checklist[0]];
          user.currentChecklistDay = 1;
          user.weeklyChecklist = {
            source: 'ai',
            raw: checklist,
            createdAt: new Date(),
          };
          await user.save();

          await bot.sendMessage(chatId, `🧠 AI-generated checklist loaded!\n\nHere's your task for today:\n${checklist[0]}`);
        }
        return;
      }

      // Daily check-in
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

          const aiReply = await getSmartResponse(user, '✅ I completed my tasks today!', 'checkin_success');
          await bot.sendMessage(chatId, aiReply);

          const milestoneMessages = {
            3: "🔥 3 days strong! You're warming up!",
            7: "🎉 A whole week done! You’re building serious momentum!",
            14: "🌟 2 WEEKS of consistency! Who even *are* you now?",
            21: "🥳 21 days—this is how habits stick!",
            30: "🏆 A MONTH! Legends show up daily like you.",
            50: "🚀 50 days. You’re on another level.",
            100: "💯 *100 DAYS STRAIGHT!* This is elite focus. You're unstoppable."
          };

          if (milestoneMessages[user.streak]) {
            await bot.sendMessage(chatId, milestoneMessages[user.streak], { parse_mode: 'Markdown' });
          }

          return bot.sendMessage(chatId, '💬 What helped you stay focused today?');
        }

        if (text === '❌') {
          user.streak = 0;
          user.stage = 'awaiting_negative_reflection';
          await user.save();

          const aiReply = await getSmartResponse(
            user,
            `❌ I didn’t complete my tasks. Here’s what I said: "${user.focus}". Give me a strict but honest analysis of why I might be stuck, mindset issues, self-sabotage patterns, or lazy habits I might be hiding behind. Don't sugarcoat it. Don’t insult me either.`,
            'stuck_analysis'
          );

          await bot.sendMessage(chatId, aiReply);
          return bot.sendMessage(chatId, '💡 What got in the way today? Let’s be honest.');
        }
      }

      // Prevent double check-in
      if (
        (user.stage === 'awaiting_positive_reflection' || user.stage === 'awaiting_negative_reflection') &&
        (text === '✅' || text === '❌')
      ) {
        return bot.sendMessage(chatId, '📝 You’ve already checked in today and shared your reflection. Come back tomorrow!');
      }

      // Reflection response
      if (user.stage === 'awaiting_positive_reflection' || user.stage === 'awaiting_negative_reflection') {
        user.stage = 'completed_onboarding';
        await user.save();
        return bot.sendMessage(chatId, 'Thanks for reflecting. Let’s keep going 🚀');
      }

      // Career recommendation
      if (text === '/career') {
        user.stage = 'awaiting_strengths';
        await user.save();
        return bot.sendMessage(chatId, 'Great! Tell me a few of your strengths or interests (e.g. problem-solving, creativity, leadership).');
      }

      // Smart static response
      const reply = getSmartReply(text);
      if (reply) {
        return bot.sendMessage(chatId, reply);
      }

      // AI fallback
      try {
        const aiReply = await getSmartResponse(user, text);
        return bot.sendMessage(chatId, aiReply);
      } catch (err) {
        console.error("AI smart reply failed:", err.message);
        return bot.sendMessage(chatId, "Hmm... I'm not sure how to help with that right now.");
      }

    } catch (error) {
      console.error('Error handling message:', error);
      return bot.sendMessage(chatId, "Something went wrong. Please try again later.");
    }
  });
};

function getSmartReply(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('study') || lowerText.includes('exam') || lowerText.includes('read')) {
    return 'Let’s goooo! I believe in your brain 📚 Stay hydrated and take breaks!';
  } else if (lowerText.includes('tired') || lowerText.includes('weak') || lowerText.includes('burnt')) {
    return 'Take a breath. A short break is fine, but don’t give up!';
  }
  return null;
}

