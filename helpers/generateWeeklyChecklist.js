const { getSmartResponse } = require('../utils/openai');
const {
  isAIAllowed,
  trackAIUsage,
  getAllowedModelForUser,
} = require('../utils/subscriptionUtils');

async function generateWeeklyChecklist(user, goal, tasksLastWeek = []) {
  try {
    const aiAllowed = isAIAllowed(user);

    if (!aiAllowed) {
      return [
        "Since you're on the free plan, here’s your manual weekly planning tip:",
        `• Reflect on last week's progress.`,
        `• Set 3–5 priorities for this week aligned with your goal: "${goal}"`,
        "• Upgrade to Basic or Premium for AI-powered planning."
      ];
    }

    const model = getAllowedModelForUser(user);

    const prompt = `
You are Focusly, a weekly planning assistant powered by AI.

The user's long-term goal is: "${goal}"
Here are last week's tasks: ${tasksLastWeek.length ? tasksLastWeek.join(', ') : 'None'}

Generate a 5-point weekly checklist with short, clear, motivating tasks. Avoid being too vague.`;

    const aiResponse = await getSmartResponse(prompt, model);

    if (!aiResponse) {
      return ["AI failed to generate your weekly checklist. Try again later."];
    }

    await trackAIUsage(user);

    return aiResponse
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && /^[•\-\d]/.test(line));
  } catch (error) {
    console.error('Weekly checklist generation error:', error);
    return ["Something went wrong while generating your weekly checklist."];
  }
}

module.exports = generateWeeklyChecklist;
