// File: src/handlers/checklistHandlers.js

const { saveChecklist, carryOverIncompleteTasks, getChecklistByDate } = require('../controllers/checklistController');
const { getSmartResponse } = require('../utils/getSmartResponse');
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
 * @returns {Promise<Array<Object>>} - An array of checklist items or a message for the user.
 */
async function generateChecklist(user, goal) {
  try {
    // --- Step 1: Handle Date Calculations and Task Carry-Over ---
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const existingChecklistForToday = await getChecklistByDate(user._id, today);

    // Carry over incomplete tasks from yesterday. This function should also return
    // the carried-over tasks to be merged later.
    const carriedOverTasks = await carryOverIncompleteTasks(user._id, yesterday, today);

    // --- Step 2: Check Subscription and AI Access ---
    const aiAllowed = await hasAIUsageAccess(user, 'checklist');

    if (!aiAllowed) {
      // If AI access is denied, return a manual checklist and do not proceed with AI
      const freePlanMessage = "Since you're on the free plan, here’s a manual tip:\n" +
        `• Break your main goal "${goal}" into 3 actionable tasks.\n` +
        "• Keep them simple and realistic.\n" +
        "• Upgrade to unlock AI-powered checklists.";

      // To handle this, we can either return the message directly or save it as a task.
      // Let's return the structured response to be handled by the message handler.
      return [{
        text: freePlanMessage,
        completed: false,
        carriedOver: false
      }];
    }

    // --- Step 3: Generate AI Prompt and Get Response ---
    const tasksYesterday = carriedOverTasks.map(task => task.text);
    const model = await getModelForUser(user);
    const prompt = `
You are Focusly, a productivity AI assistant. Help the user break down their goal into a checklist.

Goal: "${goal}"

Yesterday's tasks were: ${tasksYesterday?.length ? tasksYesterday.join(', ') : 'None'}

Generate a short checklist (3–5 points) for today's focus, personalized and smart. Be strict but supportive.
Respond in JSON format as an array of strings like ["task 1", "task 2", "task 3"].`;

    const aiReply = await getSmartResponse(user.telegramId, prompt, model);

    if (!aiReply || !aiReply.messages || !Array.isArray(aiReply.messages)) {
      console.error("⚠️ AI failed to generate a valid checklist response:", aiReply);
      return [{ text: "AI failed to generate checklist. Try again later." }];
    }

    // --- Step 4: Process AI Response and Merge with Carried-Over Tasks ---
    const newAiTasks = aiReply.messages
      .flatMap(msg => msg.split('\n')) // Split each message by newline
      .map(task => ({
        text: task.trim(),
        completed: false,
        carriedOver: false,
      }))
      .filter(item => item.text); // Filter out empty strings

    // Create a combined list of tasks, preserving any existing checklist items for today
    const allTasks = existingChecklistForToday
      ? [...existingChecklistForToday.tasks, ...carriedOverTasks, ...newAiTasks]
      : [...carriedOverTasks, ...newAiTasks];

    // --- Step 5: Deduplicate and Save to Database ---
    const uniqueTasks = allTasks.reduce((accumulator, current) => {
      if (!accumulator.some(item => item.text === current.text)) {
        accumulator.push(current);
      }
      return accumulator;
    }, []);

    // Save the final, unique list of tasks to the database
    const finalChecklist = await saveChecklist(user._id, today, uniqueTasks);

    // --- Step 6: Track AI Usage and Return the Final Checklist ---
    await trackAIUsage(user, 'checklist');

    return finalChecklist.tasks; // Return the tasks of the saved checklist document
  } catch (error) {
    console.error('Checklist generation error:', error);
    return [{ text: "Something went wrong while generating your checklist." }];
  }
}

module.exports = { generateChecklist };