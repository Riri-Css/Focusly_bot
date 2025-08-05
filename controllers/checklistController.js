const Checklist = require('../models/checklist');
const { getUserByTelegramId } = require('./userController');

async function saveChecklist(userId, date, tasks) {
  return Checklist.findOneAndUpdate(
    { userId, date },
    { tasks },
    { upsert: true, new: true }
  );
}

async function getChecklistByDate(userId, date) {
  return Checklist.findOne({ userId, date });
}

async function getIncompleteTasks(userId, date) {
  const checklist = await Checklist.findOne({ userId, date });
  if (!checklist) return [];
  return checklist.tasks.filter(t => !t.completed);
}

async function carryOverIncompleteTasks(userId, fromDate, toDate) {
  const incompleteTasks = await getIncompleteTasks(userId, fromDate);
  if (incompleteTasks.length === 0) return;

  const carriedTasks = incompleteTasks.map(task => ({
    text: task.text,
    completed: false,
    carriedOver: true,
  }));

  const todayChecklist = await getChecklistByDate(userId, toDate);

  let newTasks = carriedTasks;
  if (todayChecklist) {
    // Avoid duplication if already exists
    const existingTexts = todayChecklist.tasks.map(t => t.text);
    newTasks = [
      ...todayChecklist.tasks,
      ...carriedTasks.filter(t => !existingTexts.includes(t.text))
    ];
  }

  return saveChecklist(userId, toDate, newTasks);
}

module.exports = {
  saveChecklist,
  getChecklistByDate,
  getIncompleteTasks,
  carryOverIncompleteTasks,
};
