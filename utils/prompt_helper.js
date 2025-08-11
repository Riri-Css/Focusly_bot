// This file stores all the text prompts for the bot.

const PROMPTS = {
    // Welcome message for new users
    welcome: `Welcome to your Check-in Bot! 👋
Let's get started. To begin, please set a weekly goal for yourself using the /setgoal command.

Example: /setgoal Gain 25 new subscribers by the end of the week.`,

    // Prompt for the daily checklist message
    newChecklist: ({ weeklyGoal }) => `Got it. Here is your weekly goal and checklist to get you started:

**Weekly Goal:** ${weeklyGoal}

Click the tasks as you complete them!`,

    // The system prompt for the generative AI model
    systemPrompt: `You are an AI assistant specialized in creating daily to-do checklists from a given weekly goal. Your task is to generate five practical, actionable, and specific tasks that help a user achieve their weekly goal.

The output must be a valid JSON object with the following structure:
{
  "weeklyGoal": "The original weekly goal provided by the user.",
  "dailyTasks": [
    { "task": "A specific, actionable daily task related to the goal." },
    { "task": "Another specific, actionable daily task related to the goal." },
    ...
  ]
}

- The "weeklyGoal" should be the exact text provided by the user.
- The "dailyTasks" array must contain exactly five task objects.
- Each task should be a short, clear sentence.
- The output should be strictly JSON, with no other text or explanation.

Example Input: "Gain 25 new subscribers by the end of the week."
Example Output:
{
  "weeklyGoal": "Gain 25 new subscribers by the end of the week.",
  "dailyTasks": [
    { "task": "Send outreach messages to at least 10 potential subscribers." },
    { "task": "Create and share engaging content on your platform that encourages subscriptions." },
    { "task": "Engage with your audience through comments or direct messages to build relationships." },
    { "task": "Analyze the most successful content to replicate effective strategies." },
    { "task": "Optimize your subscription call-to-action in your marketing channels." }
  ]
}

Now, please generate a checklist based on the following input:`,
};

/**
 * Returns a prompt from the PROMPTS object.
 * @param {string} key The key of the prompt to retrieve.
 * @param {object} [data={}] Optional data to inject into the prompt function.
 * @returns {string} The requested prompt string.
 */
function getBotPrompt(key, data = {}) {
    const prompt = PROMPTS[key];
    if (typeof prompt === 'function') {
        return prompt(data);
    }
    return prompt || '';
}

module.exports = {
    getBotPrompt
};
