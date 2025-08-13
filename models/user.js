// File: src/models/user.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  onboardingStep: {
    type: String,
    default: null
  },
  // 🆕 New field for conversational state management
  stage: {
    type: String,
    default: 'onboarded'
  },
  // --- ADDED/UPDATED FIELDS ---
  goalMemory: {
    text: String,
    date: Date,
  },
  checklists: [{
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
    }],
    // 🆕 New fields to store check-in status and report
    checkedIn: {
        type: Boolean,
        default: false
    },
    progressReport: String,
  }],
  // --- NEW MEMORY FIELDS FOR LONG-TERM CONTEXT ---
  recentChatMemory: [{
    text: String,
    timestamp: Date,
  }],
  importantMemory: [{
    text: String,
    timestamp: Date,
  }],
  // --- END OF NEW MEMORY FIELDS ---
  
  focusGoal: String,
  focusDuration: String,
  timelineFlag: {
    type: String,
    default: 'ok'
  },
  
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
  // ✅ CORRECTED: AI USAGE SCHEMA IS NOW AN ARRAY
  aiUsage: [{
    date: Date,
    generalCount: {
        type: Number,
        default: 0
    },
    checklistCount: {
        type: Number,
        default: 0
    }
}],
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