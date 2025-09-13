// File: src/utils/messageFormatter.js - CLEAN FORMATTER (no hardcoded responses)
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

// 🎯 Message Templates
const TEMPLATES = {
    checklist: (checklist) => {
        if (!checklist || !checklist.tasks || checklist.tasks.length === 0) {
            return `📋 *Your Daily Checklist* 📋\n\n` +
                   `You have no tasks for today.\n\n` +
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
            if ((index + 1) % 3 === 0) message += '\n'; // readability
        });

        message += `\n💪 *Completion Tip:* Focus on 3 key tasks today. Quality > quantity!`;
        
        return message;
    },

    reflection: (data) => {
        const { period, completed, total, insights, achievements, remaining } = data;
        
        let message = `📊 *${period} Reflection Report* 📊\n\n`;
        message += `📈 *Performance Summary:*\n`;
        message += `✅ Completed: ${completed}/${total} tasks (${Math.round((completed/total)*100)}%)\n\n`;
        
        if (achievements?.length > 0) {
            message += `🏆 *Major Achievements:*\n`;
            achievements.forEach((a, i) => message += `${i + 1}. ${a}\n`);
            message += '\n';
        }
        
        if (remaining?.length > 0) {
            message += `🎯 *Remaining Milestones:*\n`;
            remaining.forEach((m, i) => message += `${i + 1}. ${m}\n`);
            message += '\n';
        }
        
        if (insights?.length > 0) {
            message += `💡 *Behavior Insights:*\n`;
            insights.forEach((insight, i) => message += `• ${insight}\n`);
            message += '\n';
        }
        
        message += `🌟 *Next Steps:* Keep pushing! Consistency is your superpower.`;
        return message;
    },

    subscription: (plan, price, features, paymentUrl) => {
        let message = `💎 *Upgrade to ${plan.toUpperCase()} Plan* 💎\n\n`;
        message += `💰 *Price:* ₦${price}\n\n`;
        message += `✨ *Features Included:*\n`;
        features.forEach((feature) => {
            message += `✅ ${feature}\n`;
        });
        message += `\n🔗 [Upgrade Now](${paymentUrl})\n\n`;
        message += `*Your goals deserve the best tools!* 🚀`;
        return message;
    }
};

// ✅ AI Response Formatter (no hardcoded personality)
function formatAIResponse(aiResponse) {
    if (!aiResponse) return "I'm speechless! 🤐 Try again?";

    return aiResponse
        .replace(/\n/g, '\n\n')             // double line breaks
        .replace(/\*\*(.*?)\*\*/g, '*$1*')  // clean bold formatting
        .replace(/([.!?])\s+/g, '$1\n\n');  // break sentences neatly
}

// ✅ Emoji helper for tasks
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

// ✅ Checklist keyboard builder
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

// ✅ Final check-in message
function createFinalCheckinMessage(user, checklist) {
    const completed = checklist.tasks.filter(t => t.completed).length;
    const total = checklist.tasks.length;
    const percent = total > 0 ? (completed / total) * 100 : 0;
    const streak = user.streak || 0;

    let message = `🎉 *Check-in Complete!* 🎉\n\n`;

    if (percent === 100) {
        message += `✨ *Perfect score!* You completed all ${total} tasks today!\n\n🔥 Great job!\n\n`;
    } else if (percent >= 70) {
        message += `👍 *Strong performance!* ${completed}/${total} tasks done.\n\n💪 Keep it up!\n\n`;
    } else if (percent > 0) {
        message += `⚠️ *Room for improvement.* ${completed}/${total} tasks done.\n\nStay focused!\n\n`;
    } else {
        message += `💀 *Zero tasks completed.* Your goals need attention!\n\n`;
    }

    if (streak > 0) {
        message += `📅 *Current streak:* ${streak} days\n\n`;
    }

    message += `🌟 *Tomorrow's challenge:* Beat today's score!`;
    return message;
}

// ✅ Exports
module.exports = {
    formatChecklistMessage: TEMPLATES.checklist,
    formatReflectionMessage: TEMPLATES.reflection,
    formatSubscriptionMessage: TEMPLATES.subscription,
    formatAIResponse,
    formatChecklistKeyboard,
    createFinalCheckinMessage,
    getTaskEmoji
};
