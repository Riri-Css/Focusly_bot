// File: src/utils/messageFormatter.js - COMPREHENSIVE MESSAGE STYLING
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

// 🎭 Sassy Personality Responses
const PERSONALITY = {
    welcome: [
        "Oh look, another human trying to be productive! 😏 Welcome to Focusly – where dreams meet deadlines!",
        "Well hello there! Ready to stop procrastinating? Or should I give you 5 more minutes? 😈",
        "Look who decided to show up! Your goals were getting lonely. Welcome to Focusly! 🎯",
        "Another soul seeking productivity? Don't worry, I'll whip you into shape! 💪"
    ],
    
    task_completed: [
        "Wow, you actually did something! 😲 Maybe there's hope for you after all!",
        "Task completed? Someone call the newspapers! 📰 You're on a roll!",
        "Look at you being all productive! Did hell freeze over? ❄️ Just kidding, great job! 😉",
        "Okay, I see you! One task down, only 99 more to go! 🎯"
    ],
    
    task_missed: [
        "Shocker! Another task bites the dust. 🙄 Your excuses are more creative than your task completion!",
        "Missed a task? I'm so surprised. 🎭 Maybe tomorrow you'll actually do something!",
        "Another one! 📉 At this rate, your goals will achieve themselves... oh wait, no they won't! 😤",
        "Task failed successfully! 💀 Let's try that again, shall we?"
    ],
    
    high_five: [
        "Boom! 💥 You're on fire! Keep this up and I might actually stop roasting you!",
        "Now we're talking! 🚀 This is the energy I signed up for!",
        "Yasss queen! 👑 You're crushing it! Don't make me get used to this though... 😏",
        "Okay, I'm impressed! 🔥 Maybe you're not hopeless after all!"
    ],
    
    motivational: [
        "Your future self is watching. Don't disappoint them. 👀",
        "The only thing standing between you and your goal is the BS you're telling yourself. 💅",
        "Stop waiting for motivation. Discipline > motivation every time. ⚡",
        "Your dream doesn't have an expiration date. But your excuses do. ⏰"
    ]
};

// 🎯 Message Templates with Better Formatting
const TEMPLATES = {
    checklist: (checklist) => {
        if (!checklist || !checklist.tasks || checklist.tasks.length === 0) {
            return `📋 *Your Daily Checklist* 📋\n\n` +
                   `You have no tasks for today. Time to Netflix and chill? 😴\n\n` +
                   `*Pro tip:* Use /setgoal to define what you want to achieve!`;
        }

        let message = `✨ *Your Daily Action Plan* ✨\n\n`;
        message += `🎯 *Weekly Goal:* ${checklist.weeklyGoal || "No goal set? Use /setgoal!"}\n\n`;
        message += `📝 *Today's Tasks:*\n\n`;

        checklist.tasks.forEach((task, index) => {
            const status = task.completed ? '✅' : '⬜️';
            const taskText = task.text.length > 40 ? task.text.substring(0, 37) + '...' : task.text;
            const emoji = getTaskEmoji(task.text);
            
            message += `${status} *${index + 1}.* ${emoji} ${taskText}\n`;
            
            // Add spacing every 3 tasks for better readability
            if ((index + 1) % 3 === 0) message += '\n';
        });

        message += `\n💪 *Completion Tip:* Focus on 3 key tasks today. Quality > quantity!`;
        
        return message;
    },

    reflection: (data) => {
        const { period, completed, total, insights, achievements, remaining } = data;
        
        let message = `📊 *${period} Reflection Report* 📊\n\n`;
        
        message += `📈 *Performance Summary:*\n`;
        message += `✅ Completed: ${completed}/${total} tasks (${Math.round((completed/total)*100)}%)\n\n`;
        
        if (achievements && achievements.length > 0) {
            message += `🏆 *Major Achievements:*\n`;
            achievements.forEach((achievement, index) => {
                message += `${index + 1}. ${achievement}\n`;
            });
            message += '\n';
        }
        
        if (remaining && remaining.length > 0) {
            message += `🎯 *Remaining Milestones:*\n`;
            remaining.forEach((milestone, index) => {
                message += `${index + 1}. ${milestone}\n`;
            });
            message += '\n';
        }
        
        if (insights && insights.length > 0) {
            message += `💡 *Behavior Insights:*\n`;
            insights.forEach((insight, index) => {
                message += `• ${insight}\n`;
            });
            message += '\n';
        }
        
        message += `🌟 *Next Steps:* Keep pushing! Consistency is your superpower.`;
        
        return message;
    },

    subscription: (plan, price, features, paymentUrl) => {
        let message = `💎 *Upgrade to ${plan.toUpperCase()} Plan* 💎\n\n`;
        message += `💰 *Price:* ₦${price}\n\n`;
        message += `✨ *Features Included:*\n`;
        
        features.forEach((feature, index) => {
            message += `✅ ${feature}\n`;
        });
        
        message += `\n🔗 [Upgrade Now](${paymentUrl})\n\n`;
        message += `*Your goals deserve the best tools!* 🚀`;
        
        return message;
    }
};

// Helper Functions
function getRandomResponse(responses) {
    return responses[Math.floor(Math.random() * responses.length)];
}

function getTaskEmoji(taskText) {
    const text = taskText.toLowerCase();
    if (text.includes('client') || text.includes('sale')) return '💼';
    if (text.includes('write') || text.includes('content')) return '✍️';
    if (text.includes('code') || text.includes('program')) return '💻';
    if (text.includes('study') || text.includes('learn')) return '📚';
    if (text.includes('exercise') || text.includes('gym')) return '💪';
    if (text.includes('meet') || text.includes('call')) return '📞';
    if (text.includes('clean') || text.includes('organize')) return '🧹';
    if (text.includes('read') || text.includes('book')) return '📖';
    if (text.includes('email') || text.includes('message')) return '📧';
    return '📌';
}

function formatAIResponse(aiResponse, context = null) {
    if (!aiResponse) return "I'm speechless! 🤐 Try again?";

    // Add sassy prefix based on context
    const prefixes = {
        general: [
            "💡 *Brain blast!* Here's my take:\n\n",
            "🎯 *Serving truth tea:*\n\n", 
            "🔥 *Hot take incoming:*\n\n",
            "🤔 *Let me drop some knowledge:*\n\n"
        ],
        motivational: [
            "🚀 *Motivation mode activated:*\n\n",
            "💪 *Time for some real talk:*\n\n",
            "🌟 *Here's your dose of inspiration:*\n\n"
        ],
        critical: [
            "⚠️ *Reality check time:*\n\n",
            "🎭 *Let's be real for a second:*\n\n",
            "📉 *Tough love incoming:*\n\n"
        ]
    };

    const prefixType = context?.isCritical ? 'critical' : 
                      context?.isMotivational ? 'motivational' : 'general';
    
    const randomPrefix = getRandomResponse(prefixes[prefixType]);
    
    // Format the response with proper spacing
    const formattedResponse = aiResponse
        .replace(/\n/g, '\n\n')  // Double line breaks for better spacing
        .replace(/\*\*(.*?)\*\*/g, '*$1*')  // Clean bold formatting
        .replace(/([.!?])/g, '$1\n');  // Add line breaks after sentences

    return randomPrefix + formattedResponse + `\n\n💅 *Now go do something about it!*`;
}

function formatChecklistKeyboard(checklist) {
    if (!checklist || !checklist.tasks || !checklist._id) {
        return { inline_keyboard: [] };
    }

    const taskButtons = checklist.tasks.map((task, index) => {
        const taskText = (task.text || 'Task').substring(0, 20);
        const emoji = getTaskEmoji(task.text);
        const buttonText = task.completed ? `✅ ${emoji} ${taskText}` : `⬜️ ${emoji} ${taskText}`;
        
        return [{
            text: buttonText,
            callback_data: `toggle|${checklist._id}|${index}`,
        }];
    });

    const actionButtons = [
        [{ text: '✅ Submit Check-in', callback_data: `submit|${checklist._id}` }],
        [{ text: '🔄 Refresh Tasks', callback_data: `refresh|${checklist._id}` }]
    ];

    return { inline_keyboard: [...taskButtons, ...actionButtons] };
}

function createFinalCheckinMessage(user, checklist) {
    const completedTasksCount = checklist.tasks.filter(task => task.completed).length;
    const totalTasksCount = checklist.tasks.length;
    const completionPercentage = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0;
    
    const streakCount = user.streak || 0;

    let message = `🎉 *Check-in Complete!* 🎉\n\n`;

    if (completionPercentage === 100) {
        message += `✨ *Perfect score!* You completed **all ${totalTasksCount} tasks** today!\n\n`;
        message += `🔥 ${getRandomResponse(PERSONALITY.high_five)}\n\n`;
    } else if (completionPercentage >= 70) {
        message += `👍 *Great job!* You completed **${completedTasksCount}/${totalTasksCount} tasks**.\n\n`;
        message += `💪 ${getRandomResponse(PERSONALITY.task_completed)}\n\n`;
    } else if (completionPercentage > 0) {
        message += `⚠️ *Let's pick up the pace.* You completed **${completedTasksCount}/${totalTasksCount} tasks**.\n\n`;
        message += `📉 ${getRandomResponse(PERSONALITY.task_missed)}\n\n`;
    } else {
        message += `💀 *Zero tasks completed.* Your goals need attention!\n\n`;
        message += `🎭 ${getRandomResponse(PERSONALITY.task_missed)}\n\n`;
    }

    if (streakCount > 0) {
        message += `📅 *Current streak:* ${streakCount} days\n\n`;
    }

    message += `🌟 *Tomorrow's challenge:* Beat today's score!`;

    return message;
}

// Export everything
module.exports = {
    // Personality responses
    getSassyResponse: (type) => getRandomResponse(PERSONALITY[type] || PERSONALITY.general),
    
    // Message templates
    formatChecklistMessage: TEMPLATES.checklist,
    formatReflectionMessage: TEMPLATES.reflection,
    formatSubscriptionMessage: TEMPLATES.subscription,
    
    // Helper functions
    formatAIResponse,
    formatChecklistKeyboard,
    createFinalCheckinMessage,
    getTaskEmoji
};