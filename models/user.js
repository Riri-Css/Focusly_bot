// File: src/models/user.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String, // Correctly using String based on your file
    required: true,
    unique: true
  },
  name: String,
  onboardingStep: {
    type: String,
    default: null
  },
  // --- ADDED/UPDATED FIELDS ---
  goalMemory: { // The new field to store the user's primary goal
    text: String,
    date: Date,
  },
  checklists: [{ // This array will store all daily checklists
    date: {
      type: Date,
      required: true
    },
    tasks: [{
      text: String,
      completed: {
        type: Boolean,
        default: false
      },
      carriedOver: {
        type: Boolean,
        default: false
      }
    }]
  }],
  // --- END ADDED/UPDATED FIELDS ---
  
  focusGoal: String, // This field is redundant now, but kept for migration purposes
  focusDuration: String,
  timelineFlag: {
    type: String,
    default: 'ok'
  },
  
  // Note: The taskList field is no longer needed since checklists stores this
  // taskList: [String], 

  hasSubmittedTasksToday: {
    type: Boolean,
    default: false
  },
  hasCheckedInTonight: {
    type: Boolean,
    default: false
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastCheckInDate: {
    type: String,
    default: null
  },
  trialStartDate: {
    type: Date,
    default: Date.now
  },
  subscriptionStatus: {
    type: String,
    default: 'trial'
  },
  subscriptionPlan: {
    type: String,
    default: null
  },
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  paystackCustomerCode: String,
  lastPaymentDate: Date,
  paymentReference: String,
  isSubscriptionExpired: {
    type: Boolean,
    default: false
  },
  feedbackFlags: {
    day5: {
      type: Boolean,
      default: false
    },
    day12: {
      type: Boolean,
      default: false
    },
    postSubscription: {
      type: Boolean,
      default: false
    },
    quarterly: {
      type: Boolean,
      default: false
    },
  },
  aiUsage: {
    todayCount: {
      type: Number,
      default: 0
    },
    weekCount: {
      type: Number,
      default: 0
    },
    lastUsedDate: {
      type: String,
      default: null
    },
  },
  gptVersion: {
    type: String,
    default: 'gpt-4o'
  },
  aiAccessStatus: {
    type: String,
    enum: ['allowed', 'denied', 'limited'],
    default: 'allowed',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '180d',
  },
  missedCheckins: {
    type: Number,
    default: 0
  },
});

module.exports = mongoose.model('User', userSchema);