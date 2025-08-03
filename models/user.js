const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: String,
  onboardingStep: { type: String, default: null },
  focusGoal: String,
  focusDuration: String,
  timelineFlag: { type: String, default: 'ok' },
  taskList: [String],
  hasSubmittedTasksToday: { type: Boolean, default: false },
  hasCheckedInTonight: { type: Boolean, default: false },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastCheckInDate: { type: String, default: null },
  trialStartDate: { type: Date, default: Date.now },
  subscriptionStatus: { type: String, default: 'trial' }, // 'trial', 'basic', 'premium', 'expired'
  subscriptionPlan: { type: String, default: null },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  paystackCustomerCode: String,
  lastPaymentDate: Date,
  paymentReference: String,
  isSubscriptionExpired: { type: Boolean, default: false },
  feedbackFlags: {
    day5: { type: Boolean, default: false },
    day12: { type: Boolean, default: false },
    postSubscription: { type: Boolean, default: false },
    quarterly: { type: Boolean, default: false },
  },
  aiUsage: {
    todayCount: { type: Number, default: 0 },
    weekCount: { type: Number, default: 0 },
    lastUsedDate: { type: String, default: null },
  },
  gptVersion: { type: String, default: 'gpt-4o' },
  aiAccessStatus: {
    type: String,
    enum: ['allowed', 'denied', 'limited'],
    default: 'allowed',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '180d', // Automatically remove users after 6 months
  },
  missedCheckins: { type: Number, default: 0 },
});

module.exports = mongoose.model('User', userSchema);
