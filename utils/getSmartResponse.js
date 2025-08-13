// File: src/utils/getSmartResponse.js - UPDATED
const openai = require('../config/openai'); // Assuming you have this path
const { getModelForUser } = require('../utils/subscriptionUtils');

async function getSmartResponse(user, promptType, data = {}, model = 'gpt-4o', strictMode = false) {
    try {
        const userModel = getModelForUser(user);
        if (!userModel) {
            console.error('No valid OpenAI model found for user:', user.telegramId);
            return null;
        }

        let systemPromptContent, userInput;
        
        // This is a much safer way to handle the prompt content
        const goal = user.goalMemory?.text || 'No specific goal provided';
        const recent = user.recentChatMemory?.map(c => `User: ${c.text}`).join('\n') || 'No recent chats';
        const importantMemory = user.importantMemory?.map(mem => `Long-Term Note: ${mem.text}`).join('\n') || '';

        const systemPromptHeader = `
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
${recent}"`;

        switch (promptType) {
            case 'create_checklist':
                // Check if goal is valid before creating the prompt
                const currentGoal = data.goalMemory?.text || "a generic goal";
                userInput = `Please generate a new daily checklist based on this weekly goal: "${currentGoal}".`;
                systemPromptContent = systemPromptHeader + `\n\n` +
                    `Respond in this JSON format for checklists:\n` +
                    `{ "intent": "create_checklist", "weekly_goal": "A concise, specific weekly goal.", "daily_tasks": [ {"text": "Daily task 1"}, ... ] }`;
                break;
            
            case 'set_goal':
                userInput = userInput; // The user's input is the new goal
                systemPromptContent = systemPromptHeader + `\n\n` +
                    `Respond in this JSON format for setting goals:\n` +
                    `{ "intent": "create_checklist", "challenge_message": "optional sassy message", "weekly_goal": "A concise, specific weekly goal.", "daily_tasks": [ {"text": "Daily task 1"}, ... ] }`
                break;

            case 'general_chat':
            default:
                userInput = userInput; // The user's input is the general message
                systemPromptContent = systemPromptHeader + `\n\n` +
                    `Respond in this JSON format for general conversations:\n` +
                    `{ "intent": "general", "message": "A short, direct message." }`
                break;
        }

        const completion = await openai.chat.completions.create({
            model: userModel,
            response_format: { "type": "json_object" },
            messages: [{ role: 'system', content: systemPromptContent }, { role: 'user', content: userInput }],
        });

        // The rest of the function for parsing and returning the response...
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
                    message: ["I'm sorry, an internal error occurred while generating a response."],
                    intent: 'general',
                };
            }
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
            message: "Sorry, I'm currently unable to respond. Please try again later.",
            intent: 'error',
        };
    }
}

module.exports = { getSmartResponse };