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
- For “hi”, respond like: “Hey there — ready to win today?”
- For stuck/lazy/excuse messages (e.g. “I didn’t feel like doing it”), be strict but encouraging.
- If they say they’re overwhelmed ➝ break things down.
- If they skipped a task ➝ ask *why* and help them reset with firm motivation.
- If confused or vague ➝ ask for clarity with encouragement.
- ALWAYS reply with short, motivating, and conversational tone.
- You can return multiple lines — break your messages into separate parts if helpful.

Format your response like this:

<message>
<message>
<message>

Do NOT return bullet points or markdown.
`.trim(),
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0].message.content.trim();

    // Split into array of responses (based on line breaks)
    const responseArray = raw
      .split('\n')
      .map(msg => msg.trim())
      .filter(Boolean);

    return responseArray;
  } catch (error) {
    console.error('OpenAI error:', error);
    return ["Sorry, I'm currently unable to respond. Please try again later."];
  }
}

module.exports = {
  getSmartResponse,
};
