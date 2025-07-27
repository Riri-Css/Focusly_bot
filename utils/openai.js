const OpenAIApi = require('openai');
//require('dotenv').config();

const openai = new OpenAIApi({
  apiKey: process.env.OPENAI_API_KEY,
});
//const openai = new OpenAIApi(configuration);

async function getSmartResponse(prompt) {
  const completion = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a friendly productivity coach who helps users stay focused, motivated, and consistent with their goals.' },
      { role: 'user', content: prompt }
    ],
  });

  return completion.data.choices[0].message.content.trim();
}

module.exports = {
  getSmartResponse
};
