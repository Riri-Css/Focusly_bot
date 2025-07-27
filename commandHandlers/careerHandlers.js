const { getCareerRecommendation } = require('../utils/openai');

async function handleCareerCommand(bot, msg) {
  const chatId = msg.chat.id;

  const sampleUser = {
    name: "Amina",
    focus: "building a personal brand online",
    strengths: "writing, speaking, video editing"
  };

  try {
    await bot.sendMessage(chatId, "🧠 Thinking of career ideas for you...");

    const aiReply = await getCareerRecommendation(sampleUser.name, sampleUser.focus, sampleUser.strengths);

    await bot.sendMessage(chatId, `🔍 Here's what I found:\n\n${aiReply}`);
  } catch (error) {
    console.error("Error with OpenAI:", error);
    await bot.sendMessage(chatId, "❌ Sorry, something went wrong while generating career suggestions.");
  }
}

module.exports = {
  handleCareerCommand,
};
