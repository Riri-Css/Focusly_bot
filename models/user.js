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
    // The main goal memory field for long-term context - SINGLE DEFINITION
    goalMemory: {
        text: String,
        monthlyTarget: String,      // Monthly breakdown
        weeklyTarget: String,       // Weekly breakdown  
        lastUpdated: Date,
    },
    checklists: [{
        date: Date,
        weeklyGoal: String,
        tasks: [{
            text: String,
            completed: { 
                type: Boolean, 
                default: false 
            },
            isCarriedOver: {  // For tasks carried over from previous day
                type: Boolean,
                default: false
            }
        }],
        checkedIn: { 
            type: Boolean, 
            default: false 
        },
        isManual: {  // For free user manual checklists
            type: Boolean,
            default: false
        }
    }],
    // Streak tracking - FIXED FIELD NAME CONSISTENCY
    streak: {
        type: Number,
        default: 0
    },
    longestStreak: {
        type: Number,
        default: 0
    },
    lastCheckinDate: Date, // FIXED: Consistent lowercase 'i' to match your code
    // Reflection tracking fields
    lastWeeklyReflectionDate: Date,
    lastMonthlyReflectionDate: Date,
    // Subscription & AI fields
    subscriptionStatus: {
        type: String,
        enum: ['trialing', 'active', 'inactive', 'trial'],
        default: 'trialing'
    },
    subscriptionPlan: {
        type: String,
        default: 'free-trial'
    },
    subscriptionEndDate: Date,
    gptVersion: {
        type: String,
        default: 'gpt-4o-mini'
    },
    // AI usage tracking
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
    // Memory fields
    recentChats: [{  // FIXED: Changed from recentChatMemory to match your code
        text: String,
        timestamp: Date,
    }],
    importantMemories: [{  // FIXED: Changed from importantMemory to match your code
        text: String,
        timestamp: Date,
    }],
    // Pending actions for conversational flow
    pendingAction: {
        type: {
            type: String,
            enum: ['editGoal', 'manual_tasks', 'ai_goal_breakdown'],
            default: null
        },
        goalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MiniGoal',
            default: null
        },
        // Additional fields for different action types
        goalText: String,
        monthlyTarget: String,
        currentStep: String
    },
    // Handles vague mini-goal reminder flows
    pendingReminder: {
        task: { 
            type: String, 
            default: null 
        },
        waitingForTime: { 
            type: Boolean, 
            default: false 
        }
    },
    // Other fields
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
    consecutiveChecks: {  // For tracking consecutive check-ins
        type: Number,
        default: 0
    }
}, {
    timestamps: true  // Adds createdAt and updatedAt automatically
});

// Index for better performance
userSchema.index({ telegramId: 1 });
userSchema.index({ 'checklists.date': 1 });
userSchema.index({ subscriptionStatus: 1, subscriptionPlan: 1 });
userSchema.index({ 'aiUsage.date': 1 });

module.exports = mongoose.model('User', userSchema);