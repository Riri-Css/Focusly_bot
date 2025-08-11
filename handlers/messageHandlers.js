// File: src/handlers/messageHandlers.js
// This version includes the daily check-in reset logic and AI usage tracking.
const { 
  getUserByTelegramId, 
  getOrCreateUser, 
  addRecentChat, 
  addImportantMemory,
  createChecklist,
  getChecklistByDate,
  handleDailyCheckinReset
} = require('../controllers/userController');
const { hasAIUsageAccess, trackAIUsage, getModelForUser } = require('../utils/subscriptionUtils');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { sendSubscriptionOptions } = require('../utils/telegram');
const moment = require('moment-timezone');
const User = require('../models/user');

const TIMEZONE = 'Africa/Lagos';

/**
 * Sends a message to a specific chat with optional inline keyboard.
 * @param {object} bot - The Telegram bot instance.
 * @param {number} chatId - The ID of the chat to send the message to.
 * @param {string} messageText - The text of the message.
 * @param {object} [options={}] - Additional options for the message.
 */
async function sendTelegramMessage(bot, chatId, messageText, options = {}) {
  try {
    await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', ...options });
  } catch (error) {
    console.error('❌ Error sending Telegram message:', error);
  }
}

/**
 * Creates the formatted checklist message text.
 * @param {object} checklist - The checklist object.
 * @returns {string} The formatted message string.
 */
function createChecklistMessage(checklist) {
  if (!checklist || !checklist.tasks || checklist.tasks.length === 0) {
    return "You have no tasks for today.";
  }
  const tasksText = checklist.tasks.map(task => {
    const status = task.completed ? '✅' : '⬜️';
    return `${status} ${task.text}`;
  }).join('\n');
  return tasksText;
}

/**
 * Creates the inline keyboard for a checklist.
 * @param {object} checklist - The checklist object.
 * @returns {object} The inline keyboard object.
 */
function createChecklistKeyboard(checklist) {
  // Check if checklist or checklist.tasks is null/undefined
  if (!checklist || !checklist.tasks || !Array.isArray(checklist.tasks)) {
    console.error("❌ Invalid checklist provided to createChecklistKeyboard.");
    return { inline_keyboard: [] };
  }

  const taskButtons = checklist.tasks.map(task => {
    const buttonText = task.completed ? `✅ ${task.text}` : `⬜️ ${task.text}`;
    return [{
      text: buttonText,
      // Simplified and guaranteed JSON string
      callback_data: JSON.stringify({
        action: 'toggle_task',
        checklistId: checklist.id,
        taskId: task.id
      })
    }];
  });

  const submitButton = [{
    text: '✅ Submit Check-in',
    // ✅ FIX: The callback_data is updated to include the checklistId
    callback_data: JSON.stringify({
      action: 'submit_checkin',
      checklistId: checklist.id
    })
  }];

  return {
    inline_keyboard: [...taskButtons, submitButton]
  };
}

/**
 * Creates the final check-in message text.
 * @param {object} user - The user object.
 * @param {object} checklist - The checklist object.
 * @returns {string} The formatted message string.
 */
function createFinalCheckinMessage(user, checklist) {
  const completedTasksCount = checklist.tasks.filter(task => task.completed).length;
  const totalTasksCount = checklist.tasks.length;
  let message = `**Check-in Complete!** 🎉\n\n`;
  message += `You completed **${completedTasksCount}** out of **${totalTasksCount}** tasks today.\n`;
  return message;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handles incoming messages from the user.
 * @param {object} bot - The Telegram bot instance.
 * @param {object} msg - The message object from Telegram.
 */
async function handleMessage(bot, msg) {
  if (!msg || !msg.from || !msg.from.id) {
    console.error("❌ Invalid message format received:", msg);
    return;
  }

  try {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const userInput = msg.text?.trim();

    //console.log(`🔍 Received raw message: "${msg.text}"`);
    //console.log(`🔍 Trimmed user input: "${userInput}"`);

    if (!userInput) {
      await sendTelegramMessage(bot, chatId, "Hmm, I didn’t catch that. Try sending it again.");
      return;
    }
    
    let user = await getOrCreateUser(userId);

    // 🆕 Call the daily check-in reset logic at the beginning of message handling
    await handleDailyCheckinReset(user);

    const command = userInput.toLowerCase();

    if (command === '/start') {
      if (user.onboardingStep === 'start') {
        user.onboardingStep = 'awaiting_goal';
        await user.save();
        return sendTelegramMessage(bot, chatId, `Hi ${msg.from.first_name}! 👋 Welcome to Focusly. Let's start with your first weekly goal. What's one thing you want to achieve this week?`);
      } else {
        return sendTelegramMessage(bot, chatId, `Welcome back, ${msg.from.first_name}! You've already started. Use the /checkin command to get your checklist.`);
      }
    }

    if (command === '/subscription') {
      const now = moment().tz(TIMEZONE).toDate();
      const isExpired = user.subscriptionEndDate && user.subscriptionEndDate < now;
      const isActive = user.subscriptionStatus === 'active' && !isExpired;
      const isPremium = user.subscriptionPlan === 'premium' && isActive;
      
      if (isActive) {
        await sendTelegramMessage(bot, chatId, `You are currently on the **${user.subscriptionPlan}** plan, which expires on **${moment(user.subscriptionEndDate).tz(TIMEZONE).format('LL')}**. Thank you for your continued support!`);
      } else {
        await sendSubscriptionOptions(bot, chatId, isPremium);
      }
      return;
    }

    if (command === '/checkin') {
      if (!user.goalMemory || !user.goalMemory.text) {
        return sendTelegramMessage(bot, chatId, "You don't have a goal set yet! Use `/start` or `/setgoal` to define your weekly goal.");
      }
      const today = moment().tz(TIMEZONE).format('YYYY-MM-DD');
      const checklist = await getChecklistByDate(user.telegramId, today);
      if (checklist) {
        if (checklist.checkedIn) {
          return sendTelegramMessage(bot, chatId, `You've already checked in for today! You completed ${checklist.tasks.filter(t => t.completed).length} out of ${checklist.tasks.length} tasks. Great job!`);
        } else {
          const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` + createChecklistMessage(checklist);
          const keyboard = createChecklistKeyboard(checklist);
          return sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
        }
      } else {
        return sendTelegramMessage(bot, chatId, "You don't have a checklist for today yet. Use `/setgoal` to set your goal first.");
      }
    }

    if (command.startsWith('/remember')) {
      const textToRemember = command.replace('/remember', '').trim();
      if (textToRemember) {
        await addImportantMemory(user, textToRemember);
        await sendTelegramMessage(bot, chatId, "Got it. I've added that to your long-term memory.");
      } else {
        await sendTelegramMessage(bot, chatId, "What should I remember? Use the command like this: /remember [your important note]");
      }
      return;
    }
    
    if (user && user.onboardingStep === 'awaiting_goal') {
      if (userInput && userInput.length > 5) {
        user.goalMemory.text = userInput;
        user.onboardingStep = 'onboarded';
        await user.save();
        return sendTelegramMessage(bot, chatId, "Awesome! I've set your weekly goal. I'll send you a daily checklist to help you stay on track. Just type /checkin when you're ready to see it.");
      } else {
        return sendTelegramMessage(bot, chatId, "Please provide a more detailed goal. What's one thing you want to achieve this week?");
      }
    }

    // This section is only executed if the message is NOT a recognized command.
    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
      return sendTelegramMessage(bot, chatId, "⚠️ You’ve reached your AI limit or don’t have access. Upgrade your plan or wait for your usage to reset.");
    }
    const model = await getModelForUser(user);
    if (!model) {
      return sendTelegramMessage(bot, chatId, "Your current plan doesn't support AI access. Upgrade to continue.");
    }

    await addRecentChat(user, userInput);
    
    const { 
      message, 
      intent, 
      challenge_message, 
      weekly_goal, 
      daily_tasks 
    } = await getSmartResponse(user, userInput, model);

    if (intent === 'create_checklist') {
      if (challenge_message) {
        await sendTelegramMessage(bot, chatId, challenge_message);
        await delay(1500); 
      }
      
      if (daily_tasks && daily_tasks.length > 0) {
        const newChecklist = await createChecklist(user, weekly_goal, daily_tasks);
        const messageText = `Got it. Here is your weekly goal and checklist to get you started:\n\n**Weekly Goal:** ${weekly_goal}\n\n` + createChecklistMessage(newChecklist);
        const keyboard = createChecklistKeyboard(newChecklist);
        await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
      } else {
        await sendTelegramMessage(bot, chatId, "I couldn't create a checklist based on that. Can you be more specific?");
      }
    } else if (message) {
      await sendTelegramMessage(bot, chatId, message);
    } else {
      await sendTelegramMessage(bot, chatId, "I'm sorry, I don't understand that command. Please focus on your current goal and use the /checkin command when you're ready.");
    }
    
    // We only track AI usage if it was actually used (i.e. a response was generated)
    if (intent !== 'create_checklist' && message) {
        await trackAIUsage(user, 'general');
    } else if (intent === 'create_checklist') {
        await trackAIUsage(user, 'checklist');
    }
    
  } catch (error) {
    console.error("❌ Error handling message:", error);
    await sendTelegramMessage(bot, chatId, "Something went wrong while processing your message. Please try again.");
  }
}

module.exports = {
  handleMessage,
  createChecklistMessage,
  createChecklistKeyboard,
  createFinalCheckinMessage,
  sendTelegramMessage
};
