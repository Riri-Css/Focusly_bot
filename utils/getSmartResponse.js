// File: src/utils/getSmartResponse.js
// We no longer need to import `storage.js` since we're using Mongoose
const openai = require('./openai');

async function getSmartResponse(user, userInput, model = 'gpt-4o', strictMode = false) {
  // The function signature now includes `strictMode`
  // and expects the `user` object to be passed in.
  try {
    const goal = user.goalMemory?.text || 'No specific goal provided';
    
    // We now get recent chats and long-term notes from the user object, from the database.
    const recent = user.recentChatMemory?.map(c => `User: ${c.text}`).join('\n') || 'No recent chats';
    const importantMemory = user.importantMemory?.map(mem => `Long-Term Note: ${mem.text}`).join('\n') || '';

    // We'll create a dynamic system prompt that includes all the context
    const systemPromptContent = `
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

User's Goal: "${goal}"
${importantMemory ? '\nImportant Memories:\n' + importantMemory : ''}
Recent conversation:
${recent}"

The user's next message is: "${userInput}"

Respond in this strict format:

{
  "messages": ["message 1", "message 2"],
  "intent": "general | create_checklist | career_recommendation",
  "goal": "optional goal summary",
  "duration": "optional duration (e.g. this evening, 2 hours)",
  "timelineFlag": "ok | too_short | too_long | missing"
}
`.trim();

    const messages = [
        {
          role: 'system',
          content: systemPromptContent
        },
        // We no longer need to pass `prompt` as a user message
    ];

    const completion = await openai.chat.completions.create({
      model,
      response_format: { "type": "json_object" },
      messages,
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