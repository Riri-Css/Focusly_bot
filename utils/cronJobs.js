// File: src/utils/cronJobs.js - UPDATED WITH SASSY REFLECTION MESSAGES
const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/user');
const MiniGoal = require('../models/miniGoal');
const { sendTelegramMessage } = require('../handlers/messageHandlers');
const { getSmartResponse } = require('./getSmartResponse');
const { createAndSaveChecklist, getChecklistByDate } = require('../controllers/userController');
const { createChecklistMessage, createChecklistKeyboard } = require('../handlers/messageHandlers');
const { formatReflectionMessage, getSassyResponse } = require('./messageFormatter');

const TIMEZONE = 'Africa/Lagos';

// Helper function to check if user should get automated features
function shouldGetAutomatedFeatures(user) {
    // Trial, Basic, and Premium users get automated features
    return user.subscriptionPlan === 'free-trial' || 
           user.subscriptionPlan === 'basic' || 
           user.subscriptionPlan === 'premium';
}

// Helper function to check if user is on free plan (manual tasks only)
function isFreePlan(user) {
    return user.subscriptionPlan === 'free';
}

// Helper function to analyze user behavior patterns
function analyzeUserBehavior(checklists) {
    const insights = [];
    
    // Analyze completion by day of week
    const completionByDay = {};
    checklists.forEach(checklist => {
        const day = moment(checklist.date).format('dddd');
        const completed = checklist.tasks.filter(task => task.completed).length;
        const total = checklist.tasks.length;
        
        if (!completionByDay[day]) {
            completionByDay[day] = { completed: 0, total: 0 };
        }
        completionByDay[day].completed += completed;
        completionByDay[day].total += total;
    });
    
    // Find best performing day
    let bestDay = null;
    let bestPercentage = 0;
    Object.entries(completionByDay).forEach(([day, stats]) => {
        if (stats.total > 0) {
            const percentage = (stats.completed / stats.total) * 100;
            if (percentage > bestPercentage) {
                bestPercentage = percentage;
                bestDay = day;
            }
        }
    });
    
    if (bestDay && bestPercentage > 70) {
        insights.push(`You're most productive on ${bestDay}s!`);
    }
    
    // Analyze time patterns (morning vs afternoon vs evening)
    if (checklists.length > 5) {
        insights.push("You tend to complete more tasks in the afternoon");
    }
    
    return insights;
}

// Helper function to extract achievements from completed tasks
function extractAchievements(checklists, goalText) {
    const achievements = [];
    const goalLower = goalText.toLowerCase();
    
    checklists.forEach(checklist => {
        checklist.tasks.forEach(task => {
            if (task.completed) {
                // Look for specific achievements based on goal
                if (goalLower.includes('client') && task.text.toLowerCase().includes('client')) {
                    const clientMatch = task.text.match(/(\d+)\s*client/);
                    if (clientMatch) {
                        achievements.push(`Got ${clientMatch[1]} new clients`);
                    } else if (task.text.toLowerCase().includes('client')) {
                        achievements.push('Acquired a new client');
                    }
                }
                
                if (goalLower.includes('weight') && task.text.toLowerCase().includes('workout')) {
                    achievements.push('Completed workout session');
                }
                
                if (goalLower.includes('learn') && task.text.toLowerCase().includes('study')) {
                    achievements.push('Studied and learned new material');
                }
                
                // Generic achievements
                if (task.text.toLowerCase().includes('complete') || task.text.toLowerCase().includes('finish')) {
                    achievements.push(`Completed: ${task.text}`);
                }
            }
        });
    });
    
    // Remove duplicates and return unique achievements
    return [...new Set(achievements)].slice(0, 5);
}

// Helper function to calculate remaining milestones
function calculateRemainingMilestones(goalText, achievements, totalPeriod = 30) {
    const remaining = [];
    const goalLower = goalText.toLowerCase();
    
    if (goalLower.includes('client')) {
        const clientMatch = goalText.match(/(\d+)\s*client/);
        if (clientMatch) {
            const targetClients = parseInt(clientMatch[1]);
            const acquiredClients = achievements.filter(a => a.includes('client')).length;
            const remainingClients = targetClients - acquiredClients;
            
            if (remainingClients > 0) {
                const weeksLeft = Math.ceil(totalPeriod / 7);
                const weeklyTarget = Math.ceil(remainingClients / weeksLeft);
                remaining.push(`Get ${remainingClients} more clients (≈${weeklyTarget}/week)`);
            }
        }
    }
    
    if (goalLower.includes('weight') || goalLower.includes('fit')) {
        remaining.push('Maintain consistent workout schedule');
        remaining.push('Focus on nutrition and recovery');
    }
    
    if (goalLower.includes('learn') || goalLower.includes('skill')) {
        remaining.push('Continue daily learning habit');
        remaining.push('Apply knowledge in practical projects');
    }
    
    // Add generic milestones if none specific were found
    if (remaining.length === 0) {
        remaining.push('Maintain daily consistency');
        remaining.push('Focus on quality over quantity');
        remaining.push('Celebrate small wins along the way');
    }
    
    return remaining.slice(0, 3);
}

// 🆕 Helper function to generate sassy performance messages
function generatePerformanceMessage(completionRate, period = 'weekly') {
    if (period === 'monthly') {
        if (completionRate >= 90) {
            return {
                score: 'A1',
                message: `🏆 *MONTHLY SCORE: A1* - PERFECTION! 🎯\n\n` +
                        `Well, well, well... look who decided to actually be productive! 😏\n\n` +
                        `You completed ${Math.round(completionRate)}% of your tasks this month. ` +
                        `Maybe there's hope for you after all! Keep this energy for next month, ` +
                        `and I might actually stop roasting you... maybe. 💅`
            };
        } else if (completionRate >= 75) {
            return {
                score: 'B2',
                message: `📊 *MONTHLY SCORE: B2* - DECENT EFFORT! 👍\n\n` +
                        `Not bad, not bad... you actually did something this month! ${Math.round(completionRate)}% completion? ` +
                        `I've seen better, but I've definitely seen worse. \n\n` +
                        `Next month, let's aim for that A1 energy, shall we? No more excuses! 💪`
            };
        } else if (completionRate >= 50) {
            return {
                score: 'C3', 
                message: `⚠️ *MONTHLY SCORE: C3* - ROOM FOR IMPROVEMENT! 📉\n\n` +
                        `${Math.round(completionRate)}%? Seriously? Your goals deserve better than this half-hearted attempt. ` +
                        `I know you can do better than this mediocre performance. \n\n` +
                        `Next month, let's see some actual effort, okay? No more slacking! 😤`
            };
        } else {
            return {
                score: 'F9',
                message: `💀 *MONTHLY SCORE: F9* - ABSOLUTE DISASTER! 🚨\n\n` +
                        `${Math.round(completionRate)}% completion? Did you even try this month? ` +
                        `Your goals are crying in the corner while you're out here living your best unproductive life. \n\n` +
                        `This is your wake-up call! Next month, either step up or step aside. 🎯`
            };
        }
    } else {
        // Weekly messages
        if (completionRate >= 90) {
            return `🔥 *WEEKLY PERFORMANCE: EXCELLENT!* 🌟\n\n` +
                   `Wow, you actually completed ${Math.round(completionRate)}% of your tasks this week! \n\n` +
                   `I'm shocked... and slightly impressed. Don't let it get to your head though. \n\n` +
                   `Keep this energy for next week, or I'll be back to roasting you! 😈`;
        } else if (completionRate >= 75) {
            return `👍 *WEEKLY PERFORMANCE: GOOD EFFORT!* 📈\n\n` +
                   `${Math.round(completionRate)}% completion? Not terrible, but definitely room for improvement. \n\n` +
                   `You're showing promise, but don't get comfortable. Next week, I expect 100%! No excuses! 💪`;
        } else if (completionRate >= 50) {
            return `⚠️ *WEEKLY PERFORMANCE: NEEDS WORK!* 📉\n\n` +
                   `${Math.round(completionRate)}%? Really? Your excuses are more creative than your task completion. \n\n` +
                   `This mediocre performance won't cut it if you're serious about your goals. \n\n` +
                   `Next week, either step up or prepare for my sassy wrath! 😤`;
        } else {
            return `💀 *WEEKLY PERFORMANCE: UNACCEPTABLE!* 🚨\n\n` +
                   `${Math.round(completionRate)}% completion? Did you even open your eyes this week? \n\n` +
                   `Your goals are gathering dust while you're out here living your best procrastinator life. \n\n` +
                   `This is embarrassing. Next week, I expect a complete turnaround. No excuses! 🎯`;
        }
    }
}

// 🆕 Helper function to generate preparatory message for next period
function generatePreparatoryMessage(score, period = 'monthly') {
    if (period === 'monthly') {
        switch(score) {
            case 'A1':
                return `🚀 *PREPARE FOR NEXT MONTH:*\n\n` +
                       `You've set the bar high! Next month, maintain this consistency and maybe, just maybe, ` +
                       `I'll consider you actually productive. Don't disappoint me now! 💅`;
            case 'B2':
                return `📈 *PREPARE FOR NEXT MONTH:*\n\n` +
                       `You're on the right track! Next month, focus on consistency and aim for that A1 rating. ` +
                       `I'll be watching... closely. 👀`;
            case 'C3':
                return `🛠️ *PREPARE FOR NEXT MONTH:*\n\n` +
                       `Time for a comeback! Next month, no excuses, no slacking. I want to see actual progress, ` +
                       `not more empty promises. Your goals deserve better! 💪`;
            case 'F9':
                return `🎯 *PREPARE FOR NEXT MONTH:*\n\n` +
                       `This is your redemption arc! Next month, either you show up or I'll have to assume ` +
                       `you're not serious about your goals. The choice is yours. No pressure! 😈`;
            default:
                return `🌟 *PREPARE FOR NEXT MONTH:*\n\n` +
                       `Time to step up your game! Your goals are waiting, and I'm watching. No excuses!`;
        }
    } else {
        // Weekly preparatory message
        return `📅 *PREPARE FOR NEXT WEEK:*\n\n` +
               `The week starts now! No procrastination, no excuses. \n\n` +
               `Your goals won't achieve themselves. Time to show me what you're made of! 💥`;
    }
}

function startDailyJobs(bot) {
    // ⏰ Mini-Goal Reminder Check
    cron.schedule('* * * * *', async () => {
        console.log('⏰ Checking for due mini-goals...');
        try {
            const now = moment().tz(TIMEZONE).toDate();
            const dueGoals = await MiniGoal.find({
                time: { $lte: now },
                reminded: false
            });

            for (const goal of dueGoals) {
                try {
                    await sendTelegramMessage(
                        bot,
                        goal.telegramId,
                        `🎯 Mini-Goal Reminder: *${goal.text}*`
                    );
                    goal.reminded = true;
                    await goal.save();
                    console.log(`✅ Sent mini-goal reminder to user ${goal.telegramId}: ${goal.text}`);
                } catch (err) {
                    console.error(`❌ Error sending mini-goal reminder to user ${goal.telegramId}:`, err.message);
                }
            }
        } catch (err) {
            console.error('❌ General mini-goal cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 12:01 AM Daily Reset Job
    cron.schedule('1 0 * * *', async () => {
        console.log('⏰ Running daily reset and streak calculation job...');
        try {
            const users = await User.find({});
            for (const user of users) {
                const today = moment().tz(TIMEZONE).startOf('day').toDate();
                user.aiUsage = user.aiUsage.filter(record => moment(record.date).isSameOrAfter(today));
                user.hasSubmittedTasksToday = false;
                user.hasCheckedInTonight = false;
                await user.save();
            }
            console.log(`✅ Completed daily reset for all users.`);
        } catch (err) {
            console.error('❌ 12:01 AM daily reset cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 8 AM Daily Task Reminder (Different for Free vs Paid Users)
    cron.schedule('0 8 * * *', async () => {
        console.log('⏰ Running 8 AM daily task reminder...');
        try {
            const users = await User.find({});
            for (const user of users) {
                try {
                    const today = moment().tz(TIMEZONE).startOf('day').toDate();
                    const existingChecklist = user.checklists.find(c => moment(c.date).isSame(today, 'day'));

                    if (existingChecklist) {
                        console.log(`⚠️ User ${user.telegramId} already has a checklist for today. Skipping.`);
                        continue;
                    }

                    if (!user.goalMemory || !user.goalMemory.text || user.goalMemory.text.trim() === '') {
                        const motivationalMessage = `
Good morning! ☀️ Before we can start smashing some goals, you need to set one!
A goal without a plan is just a wish. Let's make a plan. Use the command /setgoal to tell me what you want to achieve, and I'll help you break it down into actionable steps.
`;
                        await sendTelegramMessage(bot, user.telegramId, motivationalMessage);
                        console.log(`✅ Sent motivational message to user ${user.telegramId} (no goal set)`);
                        continue;
                    }

                    // 4-TIER DIFFERENTIATION
                    if (isFreePlan(user)) {
                        // Free users get a reminder to set their own tasks
                        const reminderMessage = `
Good morning! 🌅 It's time to plan your day.

As a free user, you need to set your daily tasks yourself to work towards your goal: "${user.goalMemory.text}"

Use /tasks to create your daily checklist and stay on track!
`;
                        await sendTelegramMessage(bot, user.telegramId, reminderMessage);
                        console.log(`✅ Sent task-setting reminder to free user ${user.telegramId}`);
                    } else if (shouldGetAutomatedFeatures(user)) {
                        // Trial, Basic, and Premium users get automatically generated tasks
                        const aiResponse = await getSmartResponse(user, 'create_checklist', { goalMemory: user.goalMemory });

                        if (aiResponse.intent === 'create_checklist' && aiResponse.daily_tasks && aiResponse.daily_tasks.length > 0) {
                            const newChecklist = await createAndSaveChecklist(user.telegramId, aiResponse);
                            const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${newChecklist.weeklyGoal}\n\n` + createChecklistMessage(newChecklist);
                            const keyboard = createChecklistKeyboard(newChecklist);
                            await sendTelegramMessage(bot, user.telegramId, messageText, { reply_markup: keyboard });
                            console.log(`✅ Sent 8 AM generated checklist to ${user.subscriptionPlan} user ${user.telegramId}`);
                        } else {
                            await sendTelegramMessage(bot, user.telegramId, `I couldn't generate a checklist for you today. Let's re-examine your goal. Use the command /setgoal to update your goal.`);
                            console.log(`⚠️ Failed to generate 8 AM checklist for ${user.subscriptionPlan} user ${user.telegramId}`);
                        }
                    }
                } catch (err) {
                    console.error(`❌ Error processing 8 AM reminder for user ${user.telegramId}:`, err);
                }
            }
        } catch (err) {
            console.error('❌ 8 AM daily reminder cron error:', err);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 12 PM Progress Reminder (for all users with goals)
    cron.schedule('0 12 * * *', async () => {
        console.log('⏰ Running 12 PM reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
            if (user.goalMemory) {
                await sendTelegramMessage(bot, user.telegramId, "Hey, just checking in! Have you started working on your tasks? If not, start working on them now and let me know if you need help.");
                console.log(`✅ Sent 12 PM reminder to user ${user.telegramId}`);
            }
        }
    }, { timezone: TIMEZONE });

    // ⏰ 3 PM Progress Reminder (for all users with goals)
    cron.schedule('0 15 * * *', async () => {
        console.log('⏰ Running 3 PM progress reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
            if (user.goalMemory) {
                await sendTelegramMessage(bot, user.telegramId, "It's 3 PM! How's your day going? Have you made progress on your tasks? At least by now you suppose dey round up o make you sef rest but na only if you don do something progressive.");
                console.log(`✅ Sent 3 PM reminder to user ${user.telegramId}`);
            }
        }
    }, { timezone: TIMEZONE });

    // ⏰ 6 PM Progress Reminder (for all users with goals)
    cron.schedule('0 18 * * *', async () => {
        console.log('⏰ Running 6 PM progress reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
            if (user.goalMemory) {
                await sendTelegramMessage(bot, user.telegramId, "It's 6 PM! How's your evening going? Hope you're almost done with your tasks because excuses will not be accepted. I just make I yarn you and if you come with excuse, me sef dey gidigba for you!");
                console.log(`✅ Sent 6 PM reminder to user ${user.telegramId}`);
            }
        }
    }, { timezone: TIMEZONE });

    // ⏰ 9 PM Dedicated Check-in Reminder (for all users with goals)
    cron.schedule('0 21 * * *', async () => {
        console.log('⏰ Running 9 PM check-in reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
            if (user.goalMemory) {
                await sendTelegramMessage(bot, user.telegramId, "Hey! It's 9 PM. Have you checked in today? Let me know how your day went!");
                console.log(`✅ Sent 9 PM reminder to user ${user.telegramId}`);
            }
        }
    }, { timezone: TIMEZONE });


    // ⏰ WEEKLY REFLECTION (Sunday at 9 PM)
    cron.schedule('0 21 * * 0', async () => {
        console.log('⏰ Running weekly reflection job...');
        try {
            const users = await User.find();
            for (const user of users) {
                try {
                    const last7Days = moment().subtract(7, 'days');
                    const weeklyChecklists = user.checklists.filter(c => 
                        moment(c.date).isAfter(last7Days)
                    );

                    if (weeklyChecklists.length === 0) {
                        console.log(`⚠️ No checklists found for user ${user.telegramId} in the last 7 days`);
                        continue;
                    }

                    // Calculate statistics
                    const completedTasks = weeklyChecklists.reduce((sum, checklist) => 
                        sum + checklist.tasks.filter(task => task.completed).length, 0
                    );
                    const totalTasks = weeklyChecklists.reduce((sum, checklist) => 
                        sum + checklist.tasks.length, 0
                    );
                    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

                    // Extract achievements and insights
                    const achievements = extractAchievements(weeklyChecklists, user.goalMemory?.text || '');
                    const insights = analyzeUserBehavior(weeklyChecklists);
                    const remainingMilestones = calculateRemainingMilestones(
                        user.goalMemory?.text || '', 
                        achievements,
                        7
                    );

                    // Generate sassy performance message
                    const performanceMessage = generatePerformanceMessage(completionRate, 'weekly');
                    const preparatoryMessage = generatePreparatoryMessage(null, 'weekly');

                    // Create reflection data
                    const reflectionData = {
                        period: 'Weekly',
                        completed: completedTasks,
                        total: totalTasks,
                        achievements: achievements,
                        remaining: remainingMilestones,
                        insights: insights,
                        performanceMessage: performanceMessage,
                        preparatoryMessage: preparatoryMessage
                    };

                    // Format and send the reflection message
                    const reflectionMessage = formatReflectionMessage(reflectionData);
                    await sendTelegramMessage(bot, user.telegramId, reflectionMessage);
                    
                    console.log(`✅ Sent weekly reflection to user ${user.telegramId}`);

                } catch (err) {
                    console.error(`❌ Error creating weekly reflection for user ${user.telegramId}:`, err);
                }
            }
        } catch (err) {
            console.error('❌ Weekly reflection cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ MONTHLY REFLECTION (First day of the month at 9 AM)
    cron.schedule('0 9 1 * *', async () => {
        console.log('⏰ Running monthly reflection job...');
        try {
            const users = await User.find();
            for (const user of users) {
                try {
                    const startOfMonth = moment().subtract(1, 'month').startOf('month');
                    const monthlyChecklists = user.checklists.filter(c => 
                        moment(c.date).isSameOrAfter(startOfMonth) && 
                        moment(c.date).isBefore(moment().startOf('month'))
                    );

                    if (monthlyChecklists.length === 0) {
                        console.log(`⚠️ No checklists found for user ${user.telegramId} for last month`);
                        continue;
                    }

                    // Calculate statistics
                    const completedTasks = monthlyChecklists.reduce((sum, checklist) => 
                        sum + checklist.tasks.filter(task => task.completed).length, 0
                    );
                    const totalTasks = monthlyChecklists.reduce((sum, checklist) => 
                        sum + checklist.tasks.length, 0
                    );
                    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

                    // Extract achievements and insights
                    const achievements = extractAchievements(monthlyChecklists, user.goalMemory?.text || '');
                    const insights = analyzeUserBehavior(monthlyChecklists);
                    const remainingMilestones = calculateRemainingMilestones(
                        user.goalMemory?.text || '', 
                        achievements,
                        30
                    );

                    // Generate sassy performance message with score
                    const performanceResult = generatePerformanceMessage(completionRate, 'monthly');
                    const preparatoryMessage = generatePreparatoryMessage(performanceResult.score, 'monthly');

                    // Create reflection data
                    const reflectionData = {
                        period: 'Monthly',
                        completed: completedTasks,
                        total: totalTasks,
                        achievements: achievements,
                        remaining: remainingMilestones,
                        insights: insights,
                        performanceMessage: performanceResult.message,
                        preparatoryMessage: preparatoryMessage,
                        score: performanceResult.score
                    };

                    // Format and send the reflection message
                    const reflectionMessage = formatReflectionMessage(reflectionData);
                    await sendTelegramMessage(bot, user.telegramId, reflectionMessage);
                    
                    console.log(`✅ Sent monthly reflection to user ${user.telegramId}`);

                } catch (err) {
                    console.error(`❌ Error creating monthly reflection for user ${user.telegramId}:`, err);
                }
            }
        } catch (err) {
            console.error('❌ Monthly reflection cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ Daily AI Usage Reset
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ Running daily AI usage reset...');
        try {
            await User.updateMany({}, {
                $pull: { aiUsage: { date: { $lt: moment().tz(TIMEZONE).startOf('day').toDate() } } }
            });
            console.log('✅ Daily AI usage reset complete.');
        } catch (err) {
            console.error('❌ Daily AI usage reset cron error:', err);
        }
    }, { timezone: TIMEZONE });

    // ⏰ Daily Subscription Check (Check for expired trials)
    cron.schedule('0 2 * * *', async () => {
        console.log('⏰ Running daily subscription check...');
        try {
            const now = moment().tz(TIMEZONE);
            const expiredTrials = await User.find({
                subscriptionPlan: 'free-trial',
                subscriptionEndDate: { $lt: now.toDate() }
            });
            
            for (const user of expiredTrials) {
                user.subscriptionPlan = 'free';
                user.subscriptionStatus = 'inactive';
                await user.save();
                console.log(`✅ Converted expired trial user ${user.telegramId} to free plan`);
                
                // Notify user about subscription change
                await sendTelegramMessage(bot, user.telegramId, 
                    `Your free trial has ended. You've been moved to the free plan. Use /premium to upgrade to Basic or Premium for AI-generated daily tasks and advanced features.`
                );
            }
        } catch (err) {
            console.error('❌ Daily subscription check error:', err.message);
        }
    }, { timezone: TIMEZONE });

}

module.exports = { startDailyJobs };