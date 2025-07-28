const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  username: String,
  name: String,
  focus: String,
  stage: {
    type: String,
    default: 'awaiting_name'
  },

  // Onboarding & daily tasks
  manualChecklist: [String],
  dailyChecklist: [
    {
      tasks: [String],
    }
  ],
  weeklyChecklist: {
    source: String,
    raw: [String],
    createdAt: Date
  },
  currentChecklistDay: Number,
  hasCheckedInToday: {
    type: Boolean,
    default: false
  },
  lastCheckInDate: String,
  streak: {
    type: Number,
    default: 0
  },

  // Reflections
  history: [
    {
      date: String,
      focus: String,
      checkedIn: Boolean,
      tasks: [String]
    }
  ],

  // Feedback tracking
  feedbackGiven: {
    type: Boolean,
    default: false
  },
  feedbackRequestedAt: Date,
  feedbacks: [
    {
      date: Date,
      text: String
    }
  ],

  // Subscription & trial
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'subscribed', 'expired'],
    default: 'trial'
  },
  trialStartDate: Date,
  subscriptionPlan: {
    type: String,
    enum: ['basic', 'premium']
  },
  subscriptionExpiryDate: Date,
  isSubscribed: {
    type: Boolean,
    default: false
  },

  // Career assistant
  strengths: [String],
  interests: [String],
  recommendedCareers: [String]
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
