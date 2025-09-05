// File: src/utils/getSmartResponse.js - CONSOLIDATED & FINAL (FIXED)

const openai = require('./openai');
const { getModelForUser } = require('../utils/subscriptionUtils');
const moment = require('moment-timezone');
const TIMEZONE = 'Africa/Lagos';

// --- Helper: check if model supports JSON mode ---
function supportsJsonMode(model) {
    const supportedModels = [
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-3.5-turbo-1106',
        'gpt-3.5-turbo-0125',
        'gpt-4'
    ];
    return supportedModels.some(supported => model.startsWith(supported));
}

// --- Helper: safe JSON parsing with cleanup ---
function safeJsonParse(raw) {
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.warn("Primary JSON.parse failed. Attempting cleanup...");

        let cleaned = raw;

        // Strip markdown code fences
        cleaned = cleaned.replace(/```json|```/g, "").trim();

        // Replace smart quotes with normal quotes
        cleaned = cleaned.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

        // Remove trailing commas before } or ]
        cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

        // Extract JSON object if extra text is around it
        const match = cleaned.match(/{[\s\S]*}/);
        if (match) {
            cleaned = match[0];
        }

        try {
            return JSON.parse(cleaned);
        } catch (err2) {
            console.error("Final JSON parse failed. Raw:", raw);
            return {
                intent: "general",
                message: "I'm having trouble formatting my response right now, but your goals are still my top priority."
            };
        }
    }
}

async function getSmartResponse(user, promptType, data = {}, strictMode = false) {
    try {
        const userModel = getModelForUser(user);
        if (!userModel) {
            console.error('No valid OpenAI model found for user:', user.telegramId);
            return null;
        }

        // Persona and rules
        const systemPersona = `
You are GoalBot, a strict, no-nonsense, and slightly sassy personal coach. Your purpose is to push users to achieve their goals by holding them accountable. You are direct, professional, and confident. You sometimes use subtle sarcasm or "sass" when a user needs a reality check.

Your responses must be structured as a JSON object with a specific 'intent' and follow these rules:

**RULES:**
- **Goal Setting:** When a user sets a new goal, you must evaluate the timeline.
    - If the timeline is unrealistic, respond with a direct, sassy message challenging them.
    - After a reasonable goal and timeline are established, break it down into a weekly goal and 3-5 concrete, actionable daily tasks.
- **Task Assistance:** Act as a specialized advisor. Give specific, actionable advice.
- **Accountability:** If a user misses 3+ check-ins, activate "Strict Mode." Tone becomes less forgiving.
- **General Conversation:** Keep non-goal-related conversations brief and to the point.
- **Output Format:** ALWAYS respond in JSON. Do not include markdown or other prose outside JSON.
- **Intent Recognition:** You must analyze the user's message and determine their primary intent.
`;

        const messages = [];

        // Add current date
        messages.push({ role: 'system', content: `The current date and time is ${moment().tz(TIMEZONE).format('YYYY-MM-DD h:mm A')}.` });
        messages.push({ role: 'system', content: systemPersona });

        const goal = user.goalMemory?.text;
        if (goal) {
            messages.push({ role: 'system', content: `The user's main goal is: "${goal}"` });
        }

        // Add recent chat history
        const recentChats = user.recentChatMemory || [];
        recentChats.slice(-10).forEach(chat => {
            messages.push({ role: 'user', content: chat.text });
        });

        const importantMemory = user.importantMemory?.map(mem => mem.text).join('\n');
        if (importantMemory) {
            messages.push({ role: 'system', content: `Important long-term notes about the user:\n${importantMemory}` });
        }

        let userInputContent;
        let responseFormat;

        switch (promptType) {
            case 'create_checklist':
                const currentGoal = data.goalMemory?.text || "a generic goal";
                userInputContent = `Please generate a new daily checklist based on this weekly goal: "${currentGoal}".`;
                responseFormat = `{ "intent": "create_checklist", "weekly_goal": "A concise, specific weekly goal.", "daily_tasks": [ {"text": "Daily task 1"}, ... ] }`;
                break;

            case 'set_goal':
                userInputContent = data.userInput || "No input provided";
                responseFormat = `{ "intent": "create_checklist", "challenge_message": "optional sassy message", "weekly_goal": "A concise, specific weekly goal.", "daily_tasks": [ {"text": "Daily task 1"}, ... ] }`;
                break;

            case 'weekly_reflection_with_goal':
                const weeklyChecklistSummary = data.recentChecklists.map(c => {
                    const totalTasks = c.tasks.length;
                    const completedTasks = c.tasks.filter(t => t.completed).length;
                    return `Date: ${moment(c.date).tz(TIMEZONE).format('MM/DD')}, Tasks: ${completedTasks}/${totalTasks}`;
                }).join('\n');
                const weeklyChatsSummary = data.recentChats.map(c => `User: ${c.text}`).join('\n');

                userInputContent = `It's time for a weekly reflection. Here is a summary of the user's check-ins and chats from this past week:\n\n` +
                            `Weekly Check-ins:\n${weeklyChecklistSummary}\n\n` +
                            `Recent Chats:\n${weeklyChatsSummary}\n\n` +
                            `Based on this data, provide a weekly reflection message. Start by celebrating their achievements, then gently point out any weaknesses (e.g., missed days), and offer one actionable piece of advice for the upcoming week.`;
                responseFormat = `{ "intent": "weekly_reflection", "message": "Your sassy, direct reflection message here." }`;
                break;

            case 'monthly_reflection_with_goal':
                const monthlyChecklistSummary = data.recentChecklists.map(c => {
                    const totalTasks = c.tasks.length;
                    const completedTasks = c.tasks.filter(t => t.completed).length;
                    return `Date: ${moment(c.date).tz(TIMEZONE).format('MM/DD')}, Tasks: ${completedTasks}/${totalTasks}`;
                }).join('\n');
                const monthlyChatsSummary = data.recentChats.map(c => `User: ${c.text}`).join('\n');

                userInputContent = `It's time for a monthly reflection. Here is a summary of the user's check-ins and chats from this past month:\n\n` +
                            `Monthly Check-ins:\n${monthlyChecklistSummary}\n\n` +
                            `Recent Chats:\n${monthlyChatsSummary}\n\n` +
                            `Analyze the user's performance for the month. Provide a detailed summary of their overall progress, identify recurring strengths and weaknesses, and give a strategic tip for the next month.`;
                responseFormat = `{ "intent": "monthly_reflection", "message": "Your sassy, direct reflection message here." }`;
                break;

            case 'motivational_message_without_goal':
                userInputContent = "The user currently has no goal set. Send a deep, inspiring motivational message that encourages them to find a goal and take the first step towards personal growth. The message should still be in your sassy, direct tone.";
                responseFormat = `{ "intent": "motivational", "message": "Your sassy motivational message here." }`;
                break;

            case 'conversational_intent':
            userInputContent = data.userInput || "No input provided";
            responseFormat = `Based on the user's message, classify their primary intent from this expanded list:
                    
                    **Enhanced Intent List:**
                    1. **list_mini_goals**: "how many mini goals", "list my reminders", "show me my mini goals"
                    2. **list_all_goals**: "how many goals", "show me all my goals", "what are my goals"
                    3. **request_guidance**: "how do I", "help me with", "I'm stuck", "what should I do", "how to complete", "guide me"
                    4. **discuss_strategy**: "strategy for", "how to achieve", "plan for", "best way to", "approach for"
                    5. **set_goal_breakdown**: "monthly target", "weekly milestone", "break down my goal", "how to measure"
                    6. **general**: If the message doesn't fit any other category.

                    **Response Format:**
                    - If intent is 'list_mini_goals': { "intent": "list_mini_goals" }
                    - If intent is 'list_all_goals': { "intent": "list_all_goals" }
                    - If intent is 'request_guidance': { "intent": "request_guidance", "task_context": "brief description of what they need help with" }
                    - If intent is 'discuss_strategy': { "intent": "discuss_strategy", "goal_aspect": "which part of the goal needs strategy" }
                    - If intent is 'set_goal_breakdown': { "intent": "set_goal_breakdown", "breakdown_type": "monthly or weekly" }
                    - If intent is 'general': { "intent": "general", "message": "Your sassy, direct response" }`;
            break;

                // Add these new cases to the switch statement
            case 'goal_breakdown_suggestion':
            userInputContent = `The user is setting up a goal breakdown. Their goal is: "${data.goalText}". 
            For the breakdown type: "${data.breakdownType}", provide a thoughtful suggestion.`;
            responseFormat = `{
                "intent": "goal_breakdown_suggestion",
                "suggestion": "Your AI-generated suggestion for the breakdown",
                "reasoning": "Brief explanation of why this breakdown makes sense"
            }`;
            break;

            case 'task_guidance':
            userInputContent = `The user needs guidance. Their goal: "${data.goalText}". 
            They need help with: "${data.taskContext}". Provide specific, actionable advice.`;
            responseFormat = `{
                "intent": "task_guidance", 
                "message": "Your direct, actionable guidance here. Be specific and practical."
            }`;
            break;

            case 'goal_strategy':
            userInputContent = `The user wants strategy discussion. Their goal: "${data.goalText}".
            They're focusing on: "${data.goalAspect}". Provide strategic advice.`;
            responseFormat = `{
                "intent": "goal_strategy",
                "message": "Your strategic, in-depth advice here. Be serious and comprehensive."
            }`;
            break;

            case 'general_chat':
            default:
                userInputContent = data.userInput || "Hello, let's talk goals!";
                responseFormat = `{ "intent": "general", "message": "Provide a short, direct, sassy message." }`;
                break;
        }

        if (!userInputContent || typeof userInputContent !== 'string') {
            console.error('Fatal: userInput is not a valid string.');
            return {
                message: "Listen, I don't care if you just sent a sticker or emoji—let's talk about your goals. What's the plan?",
                intent: 'general',
            };
        }

        // Add format + user input
        messages.push({ role: 'system', content: `Respond in this JSON format:\n${responseFormat}` });
        messages.push({ role: 'user', content: userInputContent });

        const payload = {
            model: userModel,
            messages: messages,
        };

        if (supportsJsonMode(userModel)) {
            payload.response_format = { type: "json_object" };
        }

        const completion = await openai.chat.completions.create(payload);
        const raw = completion.choices[0].message.content.trim();
        const structured = safeJsonParse(raw);

        return structured;
    } catch (error) {
        console.error('OpenAI error:', error);
        return {
            message: "Listen, I'm currently unable to respond, but your goals won't wait. Try again in a moment.",
            intent: 'error',
        };
    }
}

module.exports = { getSmartResponse };
