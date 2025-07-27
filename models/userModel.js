const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  name: String,
  focus: String,
  stage: { type: String, default: 'onboarding' },
  hasCheckedInToday: { type: Boolean, default: false },
  subscriptionStatus: { type: String, default: 'trial' },
  trialStartDate: Date,
  subscribedPlan: String,
  subscriptionStartDate: Date,
  subscriptionExpiryDate: Date,
  usageCount: { type: Number, default: 0 },
  feedbacks: {
    message: String,
    date: { type: Date, default: Date.now }
  }
});

module.exports = mongoose.model('User', userSchema);
