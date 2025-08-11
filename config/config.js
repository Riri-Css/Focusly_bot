// This line tells our application to load the variables from your .env file.
require('dotenv').config();

// The module.exports statement makes the contents of this file available
// to other files in your project.
module.exports = {
  // We've updated the property and the environment variable to use the OpenAI API key.
  // We access the variable from the .env file using 'process.env.OPENAI_API_KEY'.
  // The '||' part provides a fallback value if the environment variable is not defined.
  openaiApiKey: process.env.OPENAI_API_KEY || 'your-default-api-key-here',
};
