const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// General smart response
async function getSmartResponse(message, user) {
  try {
    const prompt = `
You are Focusly, a smart productivity and goal-setting assistant inside Telegram. The user you're chatting with is focused on: "${user.focus}".

Your job is to give smart, helpful responses. Be friendly but strict when needed. Be short and to the point.

Here’s what the user said: "${message}"

Now respond in a helpful and motivational way.
    `;

    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    return res.choices[0].message.content.trim();
  } catch (error) {
    console.error('Smart response error:', error);
    return "Sorry, I couldn’t think of a smart reply right now.";
  }
}

// Career recommendation
async function getCareerRecommendation(user) {
  try {
    const prompt = `
A user is trying to choose a career path. Their main focus is: "${user.focus}".

Suggest 3 career paths that align with this focus, and explain each in 1 short sentence.
Avoid generic advice. Make sure your suggestions are relevant and modern.
`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    return res.choices[0].message.content.trim();
  } catch (error) {
    console.error('Career recommendation error:', error);
    return "Hmm... I couldn't generate a good career path right now. Try again soon!";
  }
}

// Intent detection for checklists
async function analyzeChecklistIntent(userMessage) {
  try {
    const prompt = `
Does the following message sound like the user is trying to provide a checklist (daily tasks) or just chatting?

Message: "${userMessage}"

Respond with exactly one word: "checklist" or "chat"
`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    return res.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    console.error('Intent analysis error:', error);
    return "chat"; // default to chat if uncertain
  }
}

module.exports = {
  getSmartResponse,
  getCareerRecommendation,
  analyzeChecklistIntent,
};
// This module provides functions to interact with OpenAI's API for generating smart responses,
// career recommendations, and intent detection for user messages in a productivity-focused Telegram bot.