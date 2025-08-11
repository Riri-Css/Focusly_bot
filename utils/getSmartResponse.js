// File: src/utils/getSmartResponse.js
const openai = require('./openai');

async function getSmartResponse(user, userInput, model = 'gpt-4o', strictMode = false) {
  try {
    const goal = user.goalMemory?.text || 'No specific goal provided';
    const recent = user.recentChatMemory?.map(c => `User: ${c.text}`).join('\n') || 'No recent chats';
    const importantMemory = user.importantMemory?.map(mem => `Long-Term Note: ${mem.text}`).join('\n') || '';

    const systemPromptContent = `
You are GoalBot, a strict, no-nonsense, and slightly sassy personal coach. Your purpose is to push users to achieve their goals by holding them accountable. You are not friendly or chatty. Your tone is direct, professional, and confident. You sometimes use subtle sarcasm or "sass" when a user needs a reality check.

Your responses must be structured as a JSON object with a specific 'intent' and follow these rules:

**RULES:**
- **Goal Setting:** When a user sets a new goal, you must evaluate the timeline.
    - If the timeline is unrealistic (e.g., 'make ₦2M in 2 weeks'), respond with a direct, sassy message challenging them to be realistic. Then, propose a more achievable goal or timeline.
    - If the timeline is too long (e.g., 'save ₦50K in 6 months earning ₦300K/weekly'), point this out and suggest a more efficient timeline.
    - After a reasonable goal and timeline are established, break it down into a weekly goal and 3-5 concrete, actionable daily tasks.
- **Task Assistance:** If a user is confused or asks for help with a task (e.g., "how do I market on LinkedIn?"), act as a specialized advisor. Give specific, actionable advice on content ideas, methods, etc.
- **Accountability:** If a user misses 3 or more check-ins, activate "Strict Mode." Your tone becomes less forgiving and more demanding.
- **General Conversation:** Keep non-goal-related conversations brief and to the point.
- **Output Format:** ALWAYS respond in JSON. Do not include markdown or any other prose outside the JSON object.

User's Goal: "${goal}"
${importantMemory ? '\nImportant Memories:\n' + importantMemory : ''}
Recent conversation:
${recent}"

The user's next message is: "${userInput}"

Respond in one of these JSON formats:

// For setting a new goal or checklist
{
  "intent": "create_checklist",
  "challenge_message": "optional sassy message if the goal/timeline is unrealistic",
  "weekly_goal": "A concise, specific weekly goal.",
  "daily_tasks": [
    // 🐛 FIX: The key for the task description has been changed to "text"
    {"text": "Daily task 1"},
    {"text": "Daily task 2"},
    {"text": "Daily task 3"}
  ]
}

// For giving advice or discussing a strategy
{
  "intent": "give_advice",
  "message": "A detailed, actionable message with advice or a new strategy."
}

// For general conversation or check-ins
{
  "intent": "general",
  "message": "A short, direct message."
}
`.trim();

    const messages = [
        {
          role: 'system',
          content: systemPromptContent
        },
    ];

    const completion = await openai.chat.completions.create({
      model,
      response_format: { "type": "json_object" },
      messages,
    });

    const raw = completion.choices[0].message.content.trim();

    let structured;
    try {
      structured = JSON.parse(raw);
    } catch (err) {
      console.warn('Warning: JSON parse failed. Attempting fallback. Raw:', raw);
      const jsonMatch = raw.match(/```json\n?([\s\S]*)\n?```|{([\s\S]*)}/);
      if (jsonMatch) {
        const jsonString = `{${jsonMatch[1] || jsonMatch[2]}}`;
        structured = JSON.parse(jsonString);
      } else {
        console.error('Fatal: Fallback JSON extraction failed. Raw:', raw);
        return {
          messages: [raw],
          intent: 'general',
          goal: '',
          duration: '',
          timelineFlag: 'missing',
        };
      }
    }
    if (!Array.isArray(structured.messages)) {
      structured.messages = [String(structured.messages || "I'm here to help.")];
    }
    
    const defaultResponse = {
      intent: 'general',
      message: "I'm here to help you get your stuff done. What's the plan?",
      challenge_message: null,
      weekly_goal: null,
      daily_tasks: null
    };

    let response = { ...defaultResponse };

    if (structured.intent === 'create_checklist') {
      response.intent = 'create_checklist';
      response.challenge_message = structured.challenge_message || null;
      response.weekly_goal = structured.weekly_goal || null;
      
      // 🐛 FIX: Add a mapping to ensure the 'text' property is always present
      response.daily_tasks = Array.isArray(structured.daily_tasks)
        ? structured.daily_tasks.map(task => ({ text: task.text || task.task || "Unnamed Task" }))
        : [];
    } else if (structured.intent === 'give_advice') {
      response.intent = 'give_advice';
      response.message = structured.message || response.message;
    } else {
      response.intent = structured.intent || 'general';
      response.message = structured.message || (Array.isArray(structured.messages) ? structured.messages.join('\n') : structured.messages) || response.message;
    }

    return response;

  } catch (error) {
    console.error('OpenAI error:', error);
    return {
      messages: ["Sorry, I'm currently unable to respond. Please try again later."],
      intent: 'error',
      goal: '',
      duration: '',
      timelineFlag: 'missing',
    };
  }
}

module.exports = {
  getSmartResponse,
};
