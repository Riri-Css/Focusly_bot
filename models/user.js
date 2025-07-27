const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  text: String,
  completed: { type: Boolean, default: false },
});

const historySchema = new mongoose.Schema({
  date: String,
  focus: String,
  tasks: String,
  checkedIn: Boolean,
});

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: String,
  focus: String,
  onboardingStep: String,

  // For streaks & check-ins
  lastCheckInDate: Date,
  streak: { type: Number, default: 0 },

  // Smart AI-generated tasks
  weeklyChecklist: {
    weekStart: Date, // e.g. Monday of the current week
    tasks: [taskSchema],
  },

  dailyChecklist: {
    date: Date, // YYYY-MM-DD
    tasks: [taskSchema],
  },

  // Manually provided by user
  manualChecklist: [String], 

  // For step-by-step tracking
  currentChecklistDay: { type: Number, default: 1 },

  // For daily reflection journaling
  reflections: [String],

  // History of progress
  history: [historySchema],

  // Subscription and trial tracking
  isSubscribed: { type: Boolean, default: false },
  trialStartedAt: { type: Date, default: Date.now },

  subscription: {
    planCode: String,
    planName: String,
    subscribedAt: Date,
    expiresAt: Date
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.user || mongoose.model('user', userSchema);
