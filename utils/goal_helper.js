// File: src/utils/getChecklistFromGoal.js

const { getBotPrompt } = require('./prompt_helper');

/**
 * Creates a structured checklist from a user's goal using the OpenAI API.
 * @param {string} weeklyGoal The user's weekly goal.
 * @returns {Promise<object>} An object containing the weekly goal and a list of daily tasks.
 */
async function getChecklistFromGoal(weeklyGoal) {
  // Get the system prompt from the prompt helper file.
  const systemPrompt = getBotPrompt('systemPrompt');

  // Construct the messages for the OpenAI API.
  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: `Create a structured checklist with daily tasks for the following weekly goal: "${weeklyGoal}"`
    }
  ];

  // Define the payload for the OpenAI API call.
  const payload = {
    model: "gpt-3.5-turbo", // You can use a different model if you prefer (e.g., gpt-4)
    response_format: { type: "json_object" },
    messages: messages
  };

  try {
    const apiKey = ""; // The API key will be provided at runtime.
    const apiUrl = `https://api.openai.com/v1/chat/completions`;
    
    // Retry logic with exponential backoff.
    let response, result;
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });
            result = await response.json();

            if (response.ok) break;

            if (response.status === 429 && i < maxRetries - 1) { // 429 Too Many Requests
                const delay = Math.pow(2, i) * 1000; // Exponential backoff
                console.log(`Rate limit hit, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw new Error(`API error: ${result.error?.message || response.statusText}`);
            }
        } catch (fetchError) {
            if (i < maxRetries - 1) {
                const delay = Math.pow(2, i) * 1000;
                console.log(`Fetch error, retrying in ${delay}ms: ${fetchError.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw fetchError;
            }
        }
    }

    // OpenAI's response structure is slightly different.
    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
      const jsonString = result.choices[0].message.content;
      const parsedJson = JSON.parse(jsonString);
      return parsedJson;
    } else {
      throw new Error('Invalid or empty response from the OpenAI API.');
    }
  } catch (error) {
    console.error('Error in getChecklistFromGoal:', error);
    throw error;
  }
}

module.exports = {
  getChecklistFromGoal,
};
