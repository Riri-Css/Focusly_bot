const { getSmartResponse } = require('./openai');
const {
  isAIAllowed,
  trackAIUsage,
  getAllowedModelForUser,
} = require('./subscriptionUtils');

async function generateChecklist(user, goal, tasksYesterday) {
  try {
    const aiAllowed = isAIAllowed(user);

    if (!aiAllowed) {
      return [
        "Since you're on the free plan, here’s a manual tip:",
        `• Break your main goal "${goal}" into 3 actionable tasks.`,
        "• Keep them simple and realistic.",
        "• Upgrade to unlock AI-powered checklists."
      ];
    }

    const model = getAllowedModelForUser(user);

    const prompt = `
You are Focusly, a productivity AI assistant. Help the user break down their goal into a checklist.

Goal: "${goal}"

Yesterday's tasks were: ${tasksYesterday?.length ? tasksYesterday.join(', ') : 'None'}

Generate a short checklist (3–5 points) for today's focus, personalized and smart. Be strict but supportive.`;

    const aiResponse = await getSmartResponse(prompt, model);

    if (!aiResponse) {
      return ["AI failed to generate checklist. Try again later."];
    }

    await trackAIUsage(user);

    return aiResponse
      .split('\n')
      .map(item => item.trim())
      .filter(item => item && /^[•\-\d]/.test(item));
  } catch (error) {
    console.error('Checklist generation error:', error);
    return ["Something went wrong while generating your checklist."];
  }
}

module.exports = generateChecklist;
