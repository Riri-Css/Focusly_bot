const openai = require('./openai');

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
// - For “hi”, respond like: “Hey there, how are you doing? Ready to win today?”
- For stuck/lazy/excuse messages (e.g. “I didn’t feel like doing it”), be strict but encouraging.
- If they say they’re overwhelmed ➝ break things down.
- If they skipped a task ➝ ask *why* and help them reset with firm motivation.
- If confused or vague ➝ ask for clarity with encouragement.
- If they say a new goal (e.g. “I want to write a book”) ➝ acknowledge it, check if the timeline is realistic, and return intent = "create_checklist".
- If they ask for career help (e.g. “I don’t know what to do with my life”) ➝ set intent = "career_recommendation".
- ALWAYS return plain messages in a motivating tone.

You must respond in this JSON format (no markdown or explanations):

{
  "messages": ["message 1", "message 2", "..."],
  "intent": "general | create_checklist | career_recommendation",
  "goal": "if any goal is mentioned",
  "duration": "if any duration is mentioned",
  "timelineFlag": "ok | too_short | too_long | missing"
}
            `.trim(),
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0].message.content.trim();

    // Try to parse the structured JSON
    let structured;
    try {
      structured = JSON.parse(raw);
    } catch (err) {
      console.warn('Warning: Could not parse JSON from OpenAI. Raw:', raw);
      // fallback: return it as a single message
      return {
        messages: [raw],
        intent: 'general',
      };
    }

    // Validate and sanitize
    if (!Array.isArray(structured.messages)) {
      structured.messages = [String(structured.messages || "I'm here to help.")];
    }

    return structured;
  } catch (error) {
    console.error('OpenAI error:', error);
    return {
      messages: ["Sorry, I'm currently unable to respond. Please try again later."],
      intent: 'error',
    };
  }
}

module.exports = {
  getSmartResponse,
};
