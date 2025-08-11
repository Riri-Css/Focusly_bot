// openaiHelper.js
// This file contains the logic for interacting with the OpenAI API.

// We will import the client instance you already created.
const openai = require('./openai');

/**
 * Sends a prompt to the OpenAI API and returns the generated text response.
 * @param {string} prompt The user's input text.
 * @returns {Promise<string>} The generated text response.
 */
async function generateResponse(prompt) {
    try {
        // Call the chat completions endpoint using the client you've already defined.
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o', // Use the model of your choice.
            messages: [{
                role: 'user',
                content: prompt
            }],
        });

        // Extract the content from the first choice in the response.
        const responseText = completion.choices[0].message.content;
        return responseText;

    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        // Return a fallback message in case of an error.
        return 'I am sorry, I am unable to generate a response right now. Please try again later.';
    }
}

// Export the function so it can be used elsewhere in the application.
module.exports = {
    generateResponse
};
