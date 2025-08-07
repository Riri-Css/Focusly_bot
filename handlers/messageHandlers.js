// File: src/handlers/messageHandlers.js
const { getSmartResponse } = require('../utils/getSmartResponse');
const { 
  getUserByTelegramId, 
  getOrCreateUser, 
  addGoalMemory, 
  addRecentChat, 
  addImportantMemory,
  updateUserField,
  updateChecklistStatus,
  getChecklistByDate 
} = require('../controllers/userController'); 
const {
  hasAIUsageAccess,
  trackAIUsage,
  getModelForUser,
} = require('../utils/subscriptionUtils');
const { sendSubscriptionOptions } = require('../utils/telegram');
const moment = require('moment-timezone'); // 🆕 Import moment for reliable date handling

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createChecklistMessage(checklist) {
  let message = '**Daily Checklist**\n\n';
  checklist.tasks.forEach(task => {
    const status = task.completed ? '✅' : '⏳';
    message += `${status} ${task.text}\n`;
  });
  return message;
}

function createChecklistKeyboard(checklist) {
  const taskButtons = checklist.tasks.map(task => [{
    text: task.completed ? 'Undo' : 'Complete',
    callback_data: `toggle_${task._id}`
  }]);

  const submitButton = [{
    text: 'Submit Check-in',
    callback_data: 'submit'
  }];

  return {
    inline_keyboard: [...taskButtons, submitButton]
  };
}

function createFinalCheckinMessage(user, checklist) {
  const completedTasksCount = checklist.tasks.filter(task => task.completed).length;
  const totalTasksCount = checklist.tasks.length;
  let message = `**Check-in Complete!** 🎉\n\n`;
  message += `You completed **${completedTasksCount}** out of **${totalTasksCount}** tasks today.\n`;
  // ⚠️ Streak logic is now handled in cronJobs.js, so we don't display it here.
  return message;
}

async function handleMessage(bot, msg) {
  if (!msg || !msg.from || !msg.from.id) {
    console.error("❌ Invalid message format received:", msg);
    return;
  }
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const userInput = msg.text?.trim();
  const TIMEZONE = 'Africa/Lagos'; // 🆕 Define timezone here for consistency

  if (!userInput) {
    await bot.sendMessage(chatId, "Hmm, I didn’t catch that. Try sending it again.");
    return;
  }

  try {
    let user = await getUserByTelegramId(userId);
    if (!user) {
      user = await getOrCreateUser(userId);
    }
    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
      await bot.sendMessage(chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
      return;
    }
    const model = await getModelForUser(user);
    if (!model) {
      await bot.sendMessage(chatId, "Your current plan doesn't support AI access. Upgrade to continue.");
      return;
    }

    // 🆕 START OF NEW INTERACTIVE CHECK-IN FEATURE LOGIC
    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        const [action, taskId] = data.split('_');
        const userId = callbackQuery.from.id;
        const chatId = callbackQuery.message.chat.id;

        try {
          let user = await getUserByTelegramId(userId);
          const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
          const todayChecklist = user.checklists.find(c => moment(c.date).tz(TIMEZONE).format('YYYY-MM-DD') === today);

          if (!todayChecklist) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "There's no checklist to update!" });
            return;
          }

          if (action === 'toggle') {
            const taskToUpdate = todayChecklist.tasks.find(task => task._id.toString() === taskId);
            if (taskToUpdate) {
              taskToUpdate.completed = !taskToUpdate.completed;
              await user.save();

              const updatedMessage = createChecklistMessage(todayChecklist);
              await bot.editMessageText(updatedMessage, {
                chat_id: chatId,
                message_id: callbackQuery.message.message_id,
                parse_mode: 'Markdown',
                reply_markup: createChecklistKeyboard(todayChecklist)
              });
              await bot.answerCallbackQuery(callbackQuery.id);
            }
          } else if (action === 'submit') {
            // ⚠️ The streak logic has been moved to the 11:59 PM cron job for reliability.
            // We only update the checklist here.
            const completedTasksCount = todayChecklist.tasks.filter(task => task.completed).length;
            const totalTasksCount = todayChecklist.tasks.length;

            todayChecklist.checkedIn = true;
            todayChecklist.progressReport = `Checked in with ${completedTasksCount} out of ${totalTasksCount} tasks completed.`;
            await user.save(); // 🆕 save the user after updating the checklist

            // 🆕 Set the hasCheckedInTonight flag so the 9 PM reminder is skipped
            user.hasCheckedInTonight = true;
            await user.save();

            const finalMessage = createFinalCheckinMessage(user, todayChecklist);
            await bot.editMessageText(finalMessage, {
              chat_id: chatId,
              message_id: callbackQuery.message.message_id,
              parse_mode: 'Markdown'
            });
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Check-in submitted!" });
          }
        } catch (error) {
            console.error("❌ Error handling callback query:", error);
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong." });
        }
    });

    // Handle the new `/checkin` command
    if (userInput.toLowerCase() === '/checkin') {
      const today = moment().tz(TIMEZONE).toDate();
      const todayChecklist = await getChecklistByDate(user._id, today);
      
      if (!todayChecklist) {
        await bot.sendMessage(chatId, "You don't have a checklist for today yet. Set your goal first!");
        return;
      }
      if (todayChecklist.checkedIn) {
        await bot.sendMessage(chatId, "You've already checked in for today! You can only check in once per day.");
        return;
      }

      const messageText = createChecklistMessage(todayChecklist);
      const keyboard = createChecklistKeyboard(todayChecklist);

      await bot.sendMessage(chatId, messageText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
      return;
    }

    // 🆕 The AI's response that creates a checklist should set a flag.
    if (userInput.startsWith('/setgoal')) {
      // ⚠️ You'll need to update your setGoal logic to handle this.
      // For now, let's assume the AI's response does this.
    }

    // Handle the `/subscribe` command
    if (userInput.toLowerCase() === '/subscribe') {
        const now = new Date();
        const isExpired = user.subscriptionEndDate && user.subscriptionEndDate < now;
        const isActive = user.subscriptionStatus === 'active' && !isExpired;

        if (isActive) {
            await bot.sendMessage(chatId, `You are currently on the **${user.subscriptionPlan}** plan, which expires on **${user.subscriptionEndDate.toDateString()}**. Thank you for your continued support!`, { parse_mode: 'Markdown' });
        } else {
            await sendSubscriptionOptions(bot, chatId);
        }
        return;
    }
    
    // Existing logic for /remember command
    if (userInput.startsWith('/remember')) {
      const textToRemember = userInput.replace('/remember', '').trim();
      if (textToRemember) {
        await addImportantMemory(user, textToRemember);
        await bot.sendMessage(chatId, "Got it. I've added that to your long-term memory.");
      } else {
        await bot.sendMessage(chatId, "What should I remember? Use the command like this: /remember [your important note]");
      }
      return;
    }
    
    // --- Existing AI-based conversation logic ---
    // 🆕 Set this flag when the AI generates a checklist.
    // For now, let's assume this happens when the goal is set.
    await addRecentChat(user, userInput);
    
    const StrictMode = user.missedCheckins >= 3;
    const { messages: aiReplyMessages, intent, goal } = await getSmartResponse(user, userInput, model, StrictMode);
    
    let aiReply = '';
    if (aiReplyMessages && Array.isArray(aiReplyMessages)) {
      aiReply = aiReplyMessages.filter(m => typeof m === 'string').join('\n\n');
    } else if (typeof aiReplyMessages === 'string') {
      aiReply = aiReplyMessages;
    } else {
      console.error("⚠️ Unexpected AI reply type:", typeof aiReplyRaw, aiReplyRaw);
      await bot.sendMessage(chatId, "The AI didn’t respond properly. Please try again.");
      return;
    }

    if (intent === 'create_checklist' && goal) {
      const goalSaved = await addGoalMemory(user, goal);
      if (goalSaved) {
        await bot.sendMessage(chatId, "I've saved your goal! I'll generate a daily checklist for you.");
        // 🆕 This is where you should set the flag that the user has a checklist for today
        user.hasSubmittedTasksToday = true;
        await user.save();
      }
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
    await trackAIUsage(user, 'general');
    
  } catch (error) {
    console.error("❌ Error handling message:", error);
    await bot.sendMessage(chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
};