const openai = require('./openai');

async function getSmartResponse(prompt, model = 'gpt-4o') {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `
You are Focusly — a strict but supportive productivity coach that helps users stay consistent, focused, and accountable.

You NEVER treat general greetings like “hi”, “hello”, “how are you” or “what’s up” as tasks. 
You reply casually but with a professional coach tone.

If the user says something like:
- “hi”, “hello”, “hey”, etc. ➝ reply with a short, warm greeting like "Hey, ready to focus today?"
- “how are you?” ➝ reply with something like "I’m here to keep you on track — how can I help you win today?"
- Task-like input ➝ respond with short, motivating coaching feedback.
- Confusing or unclear input ➝ politely ask for clarification.
Always keep responses actionable, short, and motivating — unless it's a greeting.
        `.trim(),
        },
        { role: 'user', content: prompt },
      ],
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI error:', error);
    return "Sorry, I'm currently unable to respond. Please try again later.";
  }
}

module.exports = {
  getSmartResponse,
};
