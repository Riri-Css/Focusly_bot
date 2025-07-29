const getSmartResponse = require('./getSmartResponse');
const { User } = require('../models/user');
const fallbackChecklist = [
  "Break down your main goal into 3 tasks",
  "Work on 1 task before noon",
  "Take a break and review progress",
];

async function generateChecklist(user) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  // Access control logic
  if (user.subscriptionStatus === 'expired') {
    return fallbackChecklist;
  }

  if (user.subscriptionStatus === 'trial') {
    const lastUseDate = user.lastAiUseDate?.toISOString().split('T')[0];
    if (lastUseDate !== today) {
      user.aiUsageCount = 0;
    }

    if (user.aiUsageCount >= 5) {
      return fallbackChecklist;
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
      return fallbackChecklist;
    }

    user.aiUsageCount += 1;
    user.lastAiUseDate = now;
  }

  // No AI access for unsubscribed users
  if (!user.isSubscribed && user.subscriptionStatus !== 'trial') {
    return fallbackChecklist;
  }

  try {
    const prompt = `Generate a simple 3-step checklist to help with the goal: "${user.focus}". Keep it short and actionable.`;
    const aiChecklist = await getSmartResponse(prompt, 'checklist');

    // Update user usage info
    await user.save();

    return aiChecklist || fallbackChecklist;
  } catch (err) {
    console.error('🧠 AI checklist error:', err);
    return fallbackChecklist;
  }
}

module.exports = generateChecklist;
