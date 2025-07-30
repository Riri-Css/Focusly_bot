const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  onboardingStep: { type: String, default: null },

  focus: { type: String, default: null },
  tasks: [String],

  checkIns: [
    {
      date: String, // Format: YYYY-MM-DD
      status: String, // ✅ or ❌
    }
  ],

  streak: { type: Number, default: 0 },
  lastCheckInDate: { type: String, default: null },

  reminders: {
    morning: { type: Boolean, default: true },
    afternoon: { type: Boolean, default: true },
    evening: { type: Boolean, default: true },
  },

  trialStartDate: { type: Date, default: Date.now },
  hasSubscribed: { type: Boolean, default: false },

  subscription: {
    plan: { type: String, enum: ["Basic", "Premium", null], default: null },
    status: { type: String, enum: ["active", "inactive", null], default: null },
    startDate: { type: Date },
    endDate: { type: Date },
  },

  aiUsage: {
    dailyCount: { type: Number, default: 0 },
    weeklyCount: { type: Number, default: 0 },
    lastUsedDate: { type: String }, // YYYY-MM-DD
  },

  feedbackLog: [
    {
      type: { type: String }, // e.g. "onboarding", "trial", "post-subscription"
      message: { type: String },
      date: { type: Date, default: Date.now },
    }
  ]
});

const User = mongoose.model("User", userSchema);
module.exports = User;
