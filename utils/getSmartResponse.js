const { getSmartResponse } = require('./utils/openai');
const {
  isAIAllowed,
  trackAIUsage,
  getAllowedModelForUser,
} = require('./utils/subscriptionUtils');

async function generateSmartReply(user, prompt) {
  try {
    const aiAllowed = isAIAllowed(user);
    if (!aiAllowed) {
      return "You're currently on a free plan. Upgrade to unlock smart AI responses.";
    }

    const model = getAllowedModelForUser(user);
    const response = await getSmartResponse(prompt, model);
    await trackAIUsage(user);

    return response;
  } catch (error) {
    console.error('generateSmartReply error:', error);
    return "Something went wrong generating your response. Please try again.";
  }
}

module.exports = generateSmartReply;
