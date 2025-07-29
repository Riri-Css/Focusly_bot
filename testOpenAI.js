require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');

async function testAPI() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log("❌ API key not found in .env");
    return;
  }

  console.log("✅ API key found. Making request...");

  const configuration = new Configuration({
    apiKey
  });

  const openai = new OpenAIApi(configuration);

  try {
    const response = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Say something random" }]
    });

    console.log("✅ Response received:");
    console.log(response.data.choices[0].message.content);
  } catch (error) {
    console.error("❌ Error making OpenAI request:", error.response?.data || error.message);
  }
}

testAPI();
