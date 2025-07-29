const OpenAI = require('openai');
const { incrementUsage, hasAccessToAI, isChecklistRequest } = require('../utils/subscriptionUtils');
const { User } = require('../models/user');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getSmartResponse(user, input, isChecklist = false) {
  // Check if user has access to AI
  const canUseAI = await hasAccessToAI(user, isChecklist);
  if (!canUseAI) {
    return "🔒 You’ve reached your AI usage limit. Please upgrade your plan to continue using smart features.";
  }

  // Determine model to use
  let model = 'gpt-4o'; // Default for Trial and Premium
  if (user.subscriptionStatus === 'trial' || user.subscriptionPlan === 'premium') {
    model = 'gpt-4o';
  } else if (user.subscriptionPlan === 'basic' && isChecklist) {
    model = 'gpt-3.5-turbo'; // Basic users can only use GPT-3.5 for checklist generation
  } else {
    return "🚫 Smart suggestions are only available for premium users.";
  }

  // Build system prompt
  const systemPrompt = isChecklist
    ? `You're a productivity assistant. Generate a simple, actionable checklist based on the user's focus or goal.`
    : `You’re Focusly’s AI coach. Be insightful, motivational, and practical. Help users with their goals, mindset, routines, or obstacles.`;

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input }
      ]
    });

    await incrementUsage(user.telegramId, isChecklist);
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ OpenAI error:', error?.response?.data || error.message);
    return "⚠️ I ran into an issue generating your response. Please try again later.";
  }
}

module.exports = getSmartResponse;
