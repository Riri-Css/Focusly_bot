const OpenAI = require('openai');
require('dotenv').config();

let openai;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Smart fallback function
function isAIReady() {
  return openai && process.env.OPENAI_API_KEY;
}

// General smart response
async function getSmartResponse(user, message, mode = 'default') {
  if (!isAIReady()) {
    return "🤖 Smart reply unavailable. Please try again later or upgrade your plan.";
  }

  try {
    const prompt = `
You are Focusly, a productivity coach inside Telegram. The user is focused on: "${user.focus}".

The user said: "${message}"

Respond in a way that is helpful, direct, and motivating. Use a friendly tone.
${mode === 'checkin_success' ? "They completed their tasks. Celebrate and encourage them to keep going." : ""}
${mode === 'stuck_analysis' ? "They skipped their tasks. Give a tough-love but helpful explanation of possible mindset or habits causing this." : ""}
${mode === 'onboarding_boost' ? "They just set their focus. Encourage them and help them feel excited about their journey." : ""}
`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    return res.choices[0].message.content.trim();
  } catch (error) {
    console.error('Smart response error:', error.message);
    return "❌ An unexpected error occurred. Please try again later.";
  }
}

// Career recommendation
async function getCareerRecommendation(user) {
  if (!isAIReady()) {
    return "💼 Career advice is currently unavailable. Please try again later.";
  }

  try {
    const prompt = `
A user wants help deciding their career path. Their focus is: "${user.focus}".

Suggest 3 modern, realistic career paths aligned with this focus. Briefly explain each.
`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    return res.choices[0].message.content.trim();
  } catch (error) {
    console.error('Career recommendation error:', error.message);
    return "⚠️ Couldn't generate a career suggestion right now.";
  }
}

// Checklist intent detection
async function analyzeChecklistIntent(userMessage) {
  if (!isAIReady()) return null;

  try {
    const prompt = `
Does this message sound like a checklist (daily tasks) or regular chat?

"${userMessage}"

Respond with only one word: "checklist" or "chat"
`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    return res.choices[0].message.content.trim().toLowerCase();
  } catch (error) {
    console.error('Intent analysis error:', error.message);
    return null;
  }
}

module.exports = {
  getSmartResponse,
  getCareerRecommendation,
  analyzeChecklistIntent
};
