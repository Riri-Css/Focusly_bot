// utils/generateChecklist.js
const getSmartResponse = require('./getSmartResponse');

const generateWeeklyChecklist = async (goal) => {
  const prompt = `
You're an accountability AI. A user has set this goal: "${goal}".

Generate a simple 7-day weekly checklist with daily steps to help them make real progress. Be specific, short, and helpful.

Format:
Day 1: ...
Day 2: ...
...
Day 7: ...
  `;

  const aiText = await getSmartResponse(null, prompt, 'checklist_generator');

  const checklist = aiText.split('\n').filter(line => line.startsWith('Day'));
  return checklist;
};

module.exports = generateWeeklyChecklist;
