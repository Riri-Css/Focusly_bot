const { getSmartResponse } = require('../utils/getSmartResponse');

const { getUserByTelegramId, getOrCreateUser } = require('../controllers/userController');

const {
  hasAIUsageAccess,
  trackAIUsage,
  getModelForUser,
} = require('../utils/subscriptionUtils');

const { addGoalMemory, addRecentChat } = require('../utils/storage');
const user = require('../models/user');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function handleMessage(bot, msg) {

  if (!msg || !msg.from || !msg.from.id) {

    console.error("❌ Invalid message format received:", msg);
    return;
  }

  const userId = msg.from.id;

  const chatId = msg.chat.id;

  const userInput = msg.text?.trim();



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

      await bot.sendMessage(chatId, "Your current plan doesn’t support AI access. Upgrade to continue.");

      return;

    }


    //const userInput = msg.text?.trim();
    //const model = await getAvailableModel(user);

    // ✅ Extract message(s) from smart AI response
  const aiReplyRaw = await getSmartResponse(userId, userInput, model);
  let aiReply = '';

  if (aiReplyRaw && Array.isArray(aiReplyRaw.messages)) {
  aiReply = aiReplyRaw.messages.filter(m => typeof m === 'string').join('\n\n');
  } else if (typeof aiReplyRaw === 'string') {
  aiReply = aiReplyRaw;
  } else {
  console.error("⚠️ Unexpected AI reply type:", typeof aiReplyRaw, aiReplyRaw);
  await bot.sendMessage(chatId, "The AI didn’t respond properly. Please try again.");
  return;
  }

  await addRecentChat(userId, userInput);

// Optional: If the message is a goal-setting message, save it
if (userInput.toLowerCase().includes('my goal is')) {
  await addGoalMemory(userId, userInput);
}
// ✅ Send the AI reply
//if (aiReply) {
  //await bot.sendMessage(chatId, aiReply);
//}




if (!aiReply.trim()) {

  console.error("⚠️ Empty AI reply:", aiReplyRaw);

  await bot.sendMessage(chatId, "The AI didn’t return anything useful. Try rephrasing your message.");

  return;

}



    // Split and send in chunks

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
  user.lastCheckinDate = new Date().toISOString().split('T')[0]; // Update last check-in date
  user.streak += 1; // Increment streak
  user.missedCheckins = 0; // Reset missed check-ins
  await user.save(); // Save the updated user data

}



module.exports = {

  handleMessage,

};

