const OpenAI = require('openai');
const { User } = require('../models/user');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_DAILY_USES = {
  trial: 5,
  basic: 10,
  premium: Infinity,
  expired: 0
};

// Check if user has access to smart response
async function canUseAI(user) {
  const today = new Date().toISOString().split('T')[0];

  if (user.lastAiUseDate !== today) {
    user.dailyAiUsageCount = 0;
    user.lastAiUseDate = today;
  }

  const plan = user.subscriptionPlan || user.subscriptionStatus || 'trial';
  const limit = MAX_DAILY_USES[plan] || 0;

  if (user.dailyAiUsageCount >= limit) {
    return { allowed: false, reason: 'quota' };
  }

  user.dailyAiUsageCount += 1;
  await user.save();
  return { allowed: true };
}

async function getSmartResponse(user, message) {
  const access = await canUseAI(user);
  if (!access.allowed) {
    if (user.subscriptionStatus === 'expired') {
      return `🔒 Your access has expired. Please subscribe to continue using Focusly’s AI features.`;
    }
    return `🧠 You've reached your daily AI limit.\nUpgrade to Premium for unlimited smart responses.`;
  }

  try {
    const prompt = `You're a friendly, but strict and no-nonsense accountability coach. The user said: "${message}". Respond with guidance, motivation, or a smart question.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful productivity coach named FocuslyBot.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100
    });

    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('Smart response error:', err.message);
    return `Sorry, I couldn’t think of a smart reply right now.`;
  }
}

module.exports = getSmartResponse;
