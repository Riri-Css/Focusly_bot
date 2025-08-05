// File: src/utils/getSmartResponse.js
// We no longer need to import `storage.js` since we're using Mongoose
const openai = require('./openai');

async function getSmartResponse(user, userInput, model = 'gpt-4o') {
  // IMPORTANT: This function now expects the `user` object to be passed in,
  // not just the userId. This is more efficient.
  try {
    const goal = user.goalMemory?.text || 'No specific goal provided';
    
    // We now get recent chats from the user object, which is from the database.
    const recent = user.recentChatMemory?.map(c => `User: ${c.text}`).join('\n') || 'No recent chats';
    
    const prompt = `
    You are Focusly, a strict yet supportive accountability coach. Be concise, helpful, and clear.
    This user's goal is: "${goal}"
    Recent conversation:
    ${recent}"
    User just said: "${userInput}"
    Respond with a direct message relevent to the user's message that guides or challenges them appropriately.`;

    const completion = await openai.chat.completions.create({
      model,
      response_format: { "type": "json_object" },
      messages: [
        {
          role: 'system',
          content: `
You are Focusly — a tough-love productivity coach and mindset strategist.

You help users:
- Stay accountable to their goals
- Overcome laziness, overwhelm, fear, or distraction
- Reflect on excuses and give mindset shifts
- Feel supported, but not coddled

RULES:
- Never treat greetings like “hi”, “hello”, or “how are you” as tasks.
- For stuck/lazy/excuse messages (e.g. “I didn’t feel like doing it”), be strict but encouraging.
- If they’re overwhelmed ➝ break things down.
- If they skipped a task ➝ ask *why* and help them reset with firm motivation.
- If confused or vague ➝ ask for clarity with encouragement.
- If they say a new goal (e.g. “I want to write a book”) ➝ acknowledge it, check if the timeline is realistic, and return intent = "create_checklist".
- If they ask for career help (e.g. “I don’t know what to do with my life”) ➝ set intent = "career_recommendation".
- If user gives a vague time like "this evening", assume it may relate to a previously mentioned goal.
- ALWAYS respond in JSON (no markdown or prose).

Respond in this strict format:

{
  "messages": ["message 1", "message 2"],
  "intent": "general | create_checklist | career_recommendation",
  "goal": "optional goal summary",
  "duration": "optional duration (e.g. this evening, 2 hours)",
  "timelineFlag": "ok | too_short | too_long | missing"
}
          `.trim(),
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0].message.content.trim();

    let structured;
    try {
      structured = JSON.parse(raw);
    } catch (err) {
      console.warn('Warning: JSON parse failed. Attempting fallback. Raw:', raw);
      const jsonMatch = raw.match(/```json\n?([\s\S]*)\n?```|{([\s\S]*)}/);
      if (jsonMatch) {
        const jsonString = `{${jsonMatch[1] || jsonMatch[2]}}`;
        structured = JSON.parse(jsonString);
      } else {
        console.error('Fatal: Fallback JSON extraction failed. Raw:', raw);
        return {
          messages: [raw],
          intent: 'general',
          goal: '',
          duration: '',
          timelineFlag: 'missing',
        };
      }
    }
    if (!Array.isArray(structured.messages)) {
      structured.messages = [String(structured.messages || "I'm here to help.")];
    }

    return {
      messages: structured.messages.map(msg => String(msg)),
      intent: structured.intent || 'general',
      goal: structured.goal || '',
      duration: structured.duration || '',
      timelineFlag: structured.timelineFlag || 'missing',
    };
  } catch (error) {
    console.error('OpenAI error:', error);
    return {
      messages: ["Sorry, I'm currently unable to respond. Please try again later."],
      intent: 'error',
      goal: '',
      duration: '',
      timelineFlag: 'missing',
    };
  }
}

module.exports = {
  getSmartResponse,
};