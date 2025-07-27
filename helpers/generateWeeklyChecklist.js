// utils/generateWeeklyChecklist.js
const { openai } = require('../utils/openai'); // Make sure your openai instance is properly exported

async function generateWeeklyChecklist(userFocus) {
  const prompt = `
You are a productivity assistant. Generate a detailed but simple 7-day checklist to help someone stay consistent with their goal:
"${userFocus}"

Checklist must include 5–7 specific and achievable tasks per day.
Respond in this format:
Day 1:
- Task 1
- Task 2
...
Day 2:
- Task 1
...

Avoid vague tasks like "Be consistent". Focus on real, measurable tasks.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content;
  return text;
}

module.exports = generateWeeklyChecklist;
// This module generates a weekly checklist based on the user's focus using OpenAI's API.