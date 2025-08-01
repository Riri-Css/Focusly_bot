const openai = require('./openai');
//console.log(" Fallback triggered: Calling getSmartResponse with:", message.text);
async function getSmartResponse(prompt, model = 'gpt-4o') {
  try {
    const completion = await openai.chat.completions.create({
      model,
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
- If they say they’re overwhelmed ➝ break things down.
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
      console.warn('Warning: Could not parse JSON from OpenAI. Raw:', raw);
      return {
        messages: [raw],
        intent: 'general',
        goal: '',
        duration: '',
        timelineFlag: 'missing',
      };
    }

    // Ensure response is properly shaped
    if (!Array.isArray(structured.messages)) {
      structured.messages = [String(structured.messages || "I'm here to help.")];
    }

    return {
      messages: structured.messages,
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
