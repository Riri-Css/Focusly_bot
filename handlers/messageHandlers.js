// File: src/handlers/messageHandlers.js
const { getSmartResponse } = require('../utils/getSmartResponse');
const { 
  getUserByTelegramId, 
  getOrCreateUser, 
  addRecentChat, 
  addImportantMemory,
  updateUserField,
  updateChecklistStatus,
  getChecklistByDate,
  // 🆕 We will add this function to userController.js later
  createChecklist 
} = require('../controllers/userController'); 
const {
  hasAIUsageAccess,
  trackAIUsage,
  getModelForUser,
} = require('../utils/subscriptionUtils');
const { sendSubscriptionOptions } = require('../utils/telegram');
const moment = require('moment-timezone'); 

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
  const TIMEZONE = 'Africa/Lagos'; 

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
    
    await addRecentChat(user, userInput);
    
    const StrictMode = user.missedCheckins >= 3;
    // 🆕 We now receive more fields from the new JSON format
    const { 
      message, 
      intent, 
      challenge_message, 
      weekly_goal, 
      daily_tasks 
    } = await getSmartResponse(user, userInput, model, StrictMode);
    
    // 🆕 The new logic now handles the structured response from the AI
    if (intent === 'create_checklist') {
      // Send the challenge message first if the AI provided one
      if (challenge_message) {
        await bot.sendMessage(chatId, challenge_message);
        // 🆕 Wait a moment to make the conversation feel more natural
        await delay(1500); 
      }
      
      if (daily_tasks && daily_tasks.length > 0) {
        // 🆕 Create and save the new checklist in the database
        const newChecklist = await createChecklist(user, weekly_goal, daily_tasks);
        
        const messageText = `Got it. Here is your weekly goal and checklist to get you started:\n\n**Weekly Goal:** ${weekly_goal}\n\n` + createChecklistMessage(newChecklist);
        const keyboard = createChecklistKeyboard(newChecklist);
        
        await bot.sendMessage(chatId, messageText, {
          reply_markup: keyboard,
          parse_mode: 'Markdown'
        });
      } else {
        await bot.sendMessage(chatId, "I couldn't create a checklist based on that. Can you be more specific?");
      }
    } else if (intent === 'give_advice') {
      // 🆕 Handle specific advice and strategy from the AI
      if (message) {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
    } else { // 🆕 This block now handles the 'general' intent
      // 🆕 Send the general message from the AI.
      if (message) {
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
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
  createChecklistMessage,
  createChecklistKeyboard,
  createFinalCheckinMessage
};