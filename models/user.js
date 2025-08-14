// File: src/models/user.js - CORRECTED & COMPLETE VERSION

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        required: true,
        unique: true
    },
    telegramFirstName: String,
    telegramLastName: String,
    username: String,
    onboardingStep: {
        type: String,
        enum: ['awaiting_goal', 'onboarded'],
        default: 'awaiting_goal',
    },
    // The main goal memory field for long-term context
    goalMemory: {
        text: String,
        lastUpdated: Date,
    },
    checklists: [{
        date: Date,
        weeklyGoal: String,
        tasks: [{
            text: String,
            completed: { type: Boolean, default: false },
        }],
        checkedIn: { type: Boolean, default: false },
    }],
    // Streak tracking
    currentStreak: {
        type: Number,
        default: 0
    },
    longestStreak: {
        type: Number,
        default: 0
    },
    lastCheckInDate: Date,
    // Reflection tracking fields - NEW
    lastWeeklyReflectionDate: Date,
    lastMonthlyReflectionDate: Date,
    // Subscription & AI fields
    subscriptionStatus: {
        type: String,
        enum: ['active', 'inactive', 'trial'],
        default: 'trial'
    },
    subscriptionPlan: String,
    subscriptionEndDate: Date,
    gptVersion: {
        type: String,
        default: 'gpt-4o-mini'
    },
    // AI usage is now tracked as a sub-document array
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
    // Memory fields from your original schema
    recentChatMemory: [{
        text: String,
        timestamp: Date,
    }],
    importantMemory: [{
        text: String,
        timestamp: Date,
    }],
    // Other fields from your original schema
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
    trialStartDate: {
        type: Date,
        default: Date.now
    },
    lastPaymentDate: Date,
    paymentReference: String,
    isSubscriptionExpired: {
        type: Boolean,
        default: false
    },
    missedCheckins: {
        type: Number,
        default: 0
    },
});

module.exports = mongoose.model('User', userSchema);