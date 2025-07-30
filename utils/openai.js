const OpenAI = require('./openai');

// Make sure you set OPENAI_API_KEY in Render environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// General-purpose smart response from AI
async function getSmartResponse(prompt, model = 'gpt-4o') {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a friendly but disciplined productivity coach that helps users stay focused, consistent, and accountable. You provide actionable, short, and motivating responses.',
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
