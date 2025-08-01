const openai = require('../utils/openai');
const { getUserByTelegramId, updateUserAIUsage } = require('../controllers/userController');
const { hasAIUsageAccess, getModelForUser, trackAIUsage } = require('../utils/subscriptionUtils');
const { generateChecklist } = require('../utils/generateChecklist');
const { generateWeeklyChecklist } = require('../helpers/generateWeeklyChecklist');

async function getSmartResponse(prompt, model = 'gpt-4o', user = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `
You are Focusly — a tough-love productivity coach and mindset strategist.

You help users:
- Stay accountable to their goals
- Overcome laziness, overwhelm, fear, or distraction
- Reflect on excuses and give mindset shifts
- Feel supported, but not coddled

MEMORY:
Previous goal: "${user.lastGoal || 'none'}"
Last duration mentioned: "${user.lastDuration || 'none'}"

RULES:
- Never treat greetings like “hi”, “hello”, or “how are you” as tasks.
- For stuck/lazy/excuse messages (e.g. “I didn’t feel like doing it”), be strict but encouraging.
- If they say they’re overwhelmed ➝ break things down.
- If they skipped a task ➝ ask *why* and help them reset with firm motivation.
- If confused or vague ➝ ask for clarity with encouragement.
- If they say a new goal (e.g. “I want to write a book”) ➝ acknowledge it, check if the timeline is realistic, and return intent = "create_checklist".
- If they ask for career help (e.g. “I don’t know what to do with my life”) ➝ set intent = "career_recommendation".
- If user gives a vague time like "this evening", assume it may relate to a previously mentioned goal.
- ALWAYS respond in JSON (no markdown or prose).

Respond in this strict format:

{
  "messages": ["message 1", "message 2"],
  "intent": "general | create_checklist | career_recommendation",
  "goal": "optional goal summary",
  "duration": "optional duration (e.g. this evening, 2 hours)",
  "timelineFlag": "ok | too_short | too_long | missing"
}
          `.trim(),
        },
        { role: 'user', content: prompt },
      ],
    });

    const raw = completion.choices[0].message.content.trim();

    let structured;
    try {
      structured = JSON.parse(raw);
    } catch (err) {
      console.warn('Warning: Could not parse JSON from OpenAI. Raw:', raw);
      return {
        messages: [raw],
        intent: 'general',
        goal: '',
        duration: '',
        timelineFlag: 'missing',
      };
    }

    if (!Array.isArray(structured.messages)) {
      structured.messages = [String(structured.messages || "I'm here to help.")];
    }

    return {
      messages: structured.messages,
      intent: structured.intent || 'general',
      goal: structured.goal || '',
      duration: structured.duration || '',
      timelineFlag: structured.timelineFlag || 'missing',
    };
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

async function handleMessage(bot, msg) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  const user = await getUserByTelegramId(chatId);
  if (!user) return bot.sendMessage(chatId, 'User not found.');

   if (!text) return;
  const allowed = hasAIUsageAccess(user, 'general');
  const model = getModelForUser(user);

  if (!allowed) {
     return bot.sendMessage(chatId, 'Your AI usage limit has been reached. Please subscribe or wait until your quota resets.');
  }
  //const { allowed, model, reason } = checkAIEligibility(user);
 // if (!allowed) return bot.sendMessage(chatId, 'Your AI usage limit has been reached. Please subscribe or wait until your quota resets.');

  const { messages, intent, goal, duration } = await getSmartResponse(text, model, user);

  await updateUserAIUsage(user, model); // track usage

  for (const message of messages) {
    await bot.sendMessage(chatId, message);
  }

  if (intent === 'create_checklist' && goal && duration) {
    const checklist = await generateChecklist(goal, duration, model);
    for (const item of checklist) {
      await bot.sendMessage(chatId, `📌 ${item}`);
    }
  }

  if (intent === 'career_recommendation') {
    await bot.sendMessage(chatId, "Let’s explore some career ideas. What's your background or what have you tried before?");
  }
}

module.exports = {
  getSmartResponse,
  handleMessage,
};
