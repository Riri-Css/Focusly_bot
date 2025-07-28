const OpenAI = require('openai');
require('dotenv').config();

let openai;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function generateWeeklyChecklist(focus) {
  if (!openai) {
    // 🔙 Fallback if OpenAI is unavailable
    return [
      `Work on something related to: ${focus}`,
      `Read or research more on ${focus}`,
      `Practice a task that improves your skills in ${focus}`,
      `Review your progress on ${focus}`,
      `Seek feedback or mentorship related to ${focus}`,
      `Make a small but bold improvement regarding ${focus}`,
      `Reflect on why ${focus} matters to you`
    ];
  }

  try {
    const prompt = `
You're Focusly AI. A user has committed to this focus: "${focus}".

Generate a 7-day task checklist that will help them make tangible progress toward this focus. Each task should be clear, action-oriented, and short.

Format your output as a bullet-point list with 7 items.
`;

    const res = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const checklist = res.choices[0].message.content
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^[-*•\d.]+\s*/, '').trim());

    return checklist.slice(0, 7); // Always return 7 items
  } catch (error) {
    console.error('Checklist generation error:', error.message);

    // Return fallback checklist if API fails
    return [
      `Work on something related to: ${focus}`,
      `Read or research more on ${focus}`,
      `Practice a task that improves your skills in ${focus}`,
      `Review your progress on ${focus}`,
      `Seek feedback or mentorship related to ${focus}`,
      `Make a small but bold improvement regarding ${focus}`,
      `Reflect on why ${focus} matters to you`
    ];
  }
}

module.exports = generateWeeklyChecklist;
