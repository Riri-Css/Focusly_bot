const { getBotPrompt } = require('./prompt_helper');

/**
 * Creates a structured checklist from a user's goal using the Gemini API.
 * @param {object} model The generative AI model instance.
 * @param {string} weeklyGoal The user's weekly goal.
 * @returns {Promise<object>} An object containing the weekly goal and a list of daily tasks.
 */
async function getChecklistFromGoal(model, weeklyGoal) {
  if (!model) {
    throw new Error('Generative AI model is not initialized.');
  }

  // Get the system prompt from the prompt helper file
  const systemPrompt = getBotPrompt('systemPrompt');

  // Construct the full prompt for the LLM
  const prompt = `${systemPrompt}\n\nWeekly Goal: ${weeklyGoal}`;

  const payload = {
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          "weeklyGoal": { "type": "STRING" },
          "dailyTasks": {
            "type": "ARRAY",
            "items": {
              "type": "OBJECT",
              "properties": {
                "task": { "type": "STRING" }
              }
            }
          }
        },
        "propertyOrdering": ["weeklyGoal", "dailyTasks"]
      }
    }
  };

  try {
    const apiKey = "";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    
    // Retry logic with exponential backoff
    let response, result;
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
        try {
            response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

    if (result.candidates && result.candidates.length > 0 &&
      result.candidates[0].content && result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0) {
      const jsonString = result.candidates[0].content.parts[0].text;
      const parsedJson = JSON.parse(jsonString);
      return parsedJson;
    } else {
      throw new Error('Invalid or empty response from the API.');
    }
  } catch (error) {
    console.error('Error in getChecklistFromGoal:', error);
    throw error;
  }
}

module.exports = {
  getChecklistFromGoal,
};
