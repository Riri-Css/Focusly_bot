const Checklist = require('../models/checklist');

async function getWeeklyAchievements(userId) {
  const now = new Date();
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    return date.toISOString().split('T')[0];
  });

  const checklists = await Checklist.find({
    userId,
    date: { $in: dates }
  });

  let totalCompleted = 0;
  for (const cl of checklists) {
    totalCompleted += cl.tasks.filter(t => t.completed).length;
  }

  return {
    completedTasks: totalCompleted,
    reward: totalCompleted >= 20 ? '🌟 You’re a weekly champion!' : 'Keep it up!'
  };
}

module.exports = { getWeeklyAchievements };
