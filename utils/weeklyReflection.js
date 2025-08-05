const Reflection = require('../models/reflection');
const { getWeeklyCheckinSummary } = require('../controllers/userController');

async function sendWeeklyReflection(bot, user) {
  try {
    const { completedTasks, missedTasks } = await getWeeklyCheckinSummary(user._id);

    let message;

    if (completedTasks >= 5 && missedTasks <= 2) {
      message = `🔥 You stayed focused most of this week (${completedTasks} days completed)! What helped you stay on track?`;
    } else if (missedTasks >= 4) {
      message = `You missed ${missedTasks} check-ins this week. What slowed you down or got in your way? Be honest with yourself.`;
    } else if (completedTasks === 0 && missedTasks === 0) {
      message = `It looks like you didn't check in this week. What happened? Even a small insight helps.`;
    } else {
      message = `Let’s reflect on this past week. What helped you stay focused — or what got in the way?`;
    }

    await bot.sendMessage(user.telegramId, `🧠 Weekly Reflection\n\n${message}`);
    user.awaitingReflection = true;
    await user.save();
  } catch (err) {
    console.error('Error sending weekly reflection:', err);
  }
}

module.exports = {
  sendWeeklyReflection,
};
