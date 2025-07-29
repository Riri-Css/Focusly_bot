const getSmartResponse = require('../utils/getSmartResponse');
const { User } = require('../models/user');

const fallbackWeeklyChecklist = [
  "Set clear weekly goals related to your focus",
  "Pick one priority per day",
  "Leave buffer time to review progress",
  "Midweek reflection & reset if needed",
  "Schedule focused deep work hours",
  "Avoid distractions – set phone boundaries",
  "Celebrate wins and evaluate what worked"
];

async function generateWeeklyChecklist(user) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Restrict access for expired or unsubscribed
  if (user.subscriptionStatus === 'expired') {
    return fallbackWeeklyChecklist;
  }

  if (user.subscriptionStatus === 'trial') {
    const lastUseDate = user.lastAiUseDate?.toISOString().split('T')[0];
    if (lastUseDate !== today) {
      user.aiUsageCount = 0;
    }

    if (user.aiUsageCount >= 5) {
      return fallbackWeeklyChecklist;
    }

    user.aiUsageCount += 1;
    user.lastAiUseDate = now;
  }

  if (user.subscriptionPlan === 'basic') {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const startOfWeek = weekStart.toISOString().split('T')[0];

    const lastUseDate = user.lastAiUseDate?.toISOString().split('T')[0];
    if (!user.lastAiUseDate || lastUseDate < startOfWeek) {
      user.aiUsageCount = 0;
    }

    if (user.aiUsageCount >= 10) {
      return fallbackWeeklyChecklist;
    }

    user.aiUsageCount += 1;
    user.lastAiUseDate = now;
  }

  if (!user.isSubscribed && user.subscriptionStatus !== 'trial') {
    return fallbackWeeklyChecklist;
  }

  try {
    const prompt = `Create a 7-day weekly plan to help someone stay focused on their goal: "${user.focus}". Keep each day short and focused.`;
    const aiChecklist = await getSmartResponse(prompt, 'weekly');

    // Save usage info
    await user.save();

    return aiChecklist || fallbackWeeklyChecklist;
  } catch (err) {
    console.error('🧠 AI weekly checklist error:', err);
    return fallbackWeeklyChecklist;
  }
}

module.exports = generateWeeklyChecklist;
