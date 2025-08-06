// File: src/utils/generateChecklist.js
const { saveChecklist, carryOverIncompleteTasks, getChecklistByDate } = require('../controllers/checklistController');
const { getSmartResponse } = require('./getSmartResponse');
const {
  hasAIUsageAccess,
  trackAIUsage,
  getModelForUser,
} = require('../utils/subscriptionUtils');

/**
 * Generates a personalized checklist for a user by combining AI suggestions
 * with incomplete tasks from the previous day, while also handling
 * subscription access and database persistence.
 *
 * @param {Object} user - The Mongoose user document.
 * @param {string} goal - The user's primary goal for the AI prompt.
 * @param {string} model - The AI model to use (e.g., 'gpt-4o').
 * @returns {Promise<string|null>} - A formatted message with the checklist or null on failure.
 */
async function generateChecklist(user, goal, model) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const existingChecklistForToday = await getChecklistByDate(user._id, today);

    // If a checklist already exists for today, we don't need to generate a new one.
    if (existingChecklistForToday) {
        console.log(`Checklist for user ${user.telegramId} already exists for today. Skipping generation.`);
        // Format and return the existing checklist message
        const formattedTasks = existingChecklistForToday.tasks
          .map(task => `- ${task.text}`)
          .join('\n');
        return `✅ **Your checklist for today is ready:**\n\n${formattedTasks}`;
    }

    const carriedOverTasks = await carryOverIncompleteTasks(user._id, yesterday, today);

    const aiAllowed = await hasAIUsageAccess(user, 'checklist');
    let allTasks = [...carriedOverTasks];

    if (!aiAllowed) {
      const freePlanMessage = "Since you're on the free plan, here’s a manual tip:\n" +
        `• Break your main goal "${goal}" into 3 actionable tasks.\n` +
        "• Keep them simple and realistic.\n" +
        "• Upgrade to unlock AI-powered checklists.";
      
      const manualTask = {
        text: `Your goal is: ${goal}.`,
        completed: false
      };
      allTasks.push(manualTask);

      // Save the manual task and return the free plan message
      await saveChecklist(user._id, today, allTasks);
      return freePlanMessage;
    }

    // --- CRITICAL FIXES: Correctly calling the AI ---
    const aiPrompt = `
You are Focusly, a productivity AI assistant. Help the user break down their goal into a checklist.
User's Goal: "${goal}"
Yesterday's incomplete tasks: ${carriedOverTasks.length ? carriedOverTasks.map(task => task.text).join(', ') : 'None'}
Generate a short checklist (3–5 points) for today's focus, personalized and smart. Be strict but supportive.
Respond in a simple JSON array of strings like ["task 1", "task 2", "task 3"].
`;
    
    // We now pass the entire `user` object and the AI prompt as a single user message.
    const aiResponse = await getSmartResponse(user, aiPrompt, model);

    // Process the AI response to get the checklist
    let newAiTasks = [];
    if (aiResponse && Array.isArray(aiResponse.messages)) {
      newAiTasks = aiResponse.messages
        .filter(task => typeof task === 'string' && task.trim() !== '')
        .map(task => ({
          text: task.trim(),
          completed: false,
          carriedOver: false,
        }));
    } else {
      console.error("⚠️ AI failed to generate a valid checklist response:", aiResponse);
      const manualTask = { text: `Goal: ${goal}. Review and set your tasks.`, completed: false };
      allTasks.push(manualTask);
    }
    
    allTasks = [...allTasks, ...newAiTasks];

    // Deduplicate tasks
    const uniqueTasks = allTasks.reduce((accumulator, current) => {
      if (!accumulator.some(item => item.text === current.text)) {
        accumulator.push(current);
      }
      return accumulator;
    }, []);

    // Save the final, unique list of tasks to the database
    const savedChecklist = await saveChecklist(user._id, today, uniqueTasks);

    await trackAIUsage(user, 'checklist');

    // --- Return a formatted string instead of an object ---
    const formattedTasks = savedChecklist.tasks.map(task => `- ${task.text}`).join('\n');
    return `📝 **Here's your daily checklist based on your goal:**\n\n${formattedTasks}`;

  } catch (error) {
    console.error('Checklist generation error:', error);
    return `❌ I ran into an issue while generating your checklist. Please try again later.`;
  }
}

module.exports = { generateChecklist };