// File: src/handlers/messageHandlers.js - UPDATED WITH TIER DIFFERENTIATION
const {
    getOrCreateUser,
    addRecentChat,
    addImportantMemory,
    getChecklistByDate,
    handleDailyCheckinReset,
    createAndSaveChecklist,
    setGoalMemory,
} = require('../controllers/userController');

const { 
    hasAIUsageAccess, 
    trackAIUsage,
    isFreeUser,
    isBasicUser, 
    isPremiumUser,
    hasAIAccess,
    hasAutoTasks,
    hasStreaks,
    hasReflections,
    hasSmartReminders,
    canAccessFeature
} = require('../utils/subscriptionUtils');
const { sendSubscriptionOptions } = require('../utils/telegram');
const { getSmartResponse } = require('../utils/getSmartResponse');
const { updateSubscription } = require('../utils/adminUtils');

const moment = require('moment-timezone');
const chrono = require('chrono-node');
const mongoose = require('mongoose');

const MiniGoal = require('../models/miniGoal');
const User = require('../models/user');

const TIMEZONE = 'Africa/Lagos';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

// Add goal validation function
function isValidGoal(goalText) {
    if (!goalText || goalText.trim().length < 10) {
        return false;
    }
    
    // Common greetings/small talk patterns to reject
    const invalidPatterns = [
        /^hello|hi|hey|greetings/i,
        /how are you|what's up|how's it going/i,
        /good morning|good afternoon|good evening/i,
        /^thanks|thank you|thx/i,
        /^nice to meet you|pleasure to meet you/i,
        /^what's your name|who are you/i,
        /^test|testing|just testing/i,
        /^baby|honey|dear|sweetie/i
    ];
    
    return !invalidPatterns.some(pattern => pattern.test(goalText.trim()));
}

// Helper function to send Telegram messages
async function sendTelegramMessage(bot, chatId, messageText, options = {}) {
    try {
        await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', ...options });
    } catch (error) {
        console.error('❌ Error sending Telegram message:', error);
    }
}

// Helper function to create checklist message body
function createChecklistMessage(checklist) {
    if (!checklist || !checklist.tasks || checklist.tasks.length === 0) {
        return 'You have no tasks for today.';
    }
    const tasksText = checklist.tasks
        .map((task) => {
            const taskText = task.text || 'Unnamed Task';
            const status = task.completed ? '✅' : '⬜️';
            return `${status} ${taskText}`;
        })
        .join('\n');
    return tasksText;
}

// Helper function to create inline keyboard for checklist
function createChecklistKeyboard(checklist) {
    if (!checklist || !checklist.tasks || !Array.isArray(checklist.tasks) || !checklist._id) {
        console.error('❌ Invalid checklist provided or missing _id to createChecklistKeyboard.');
        return { inline_keyboard: [] };
    }

    const taskButtons = checklist.tasks.map((task, index) => {
        const taskText = (task.text || 'Task').substring(0, 30);
        const buttonText = task.completed ? `✅ ${taskText}` : `⬜️ ${taskText}`;
        return [
            {
                text: buttonText,
                callback_data: `toggle|${checklist._id}|${index}`,
            },
        ];
    });

    const submitButton = [
        {
            text: '✅ Submit Check-in',
            callback_data: `submit|${checklist._id}`,
        },
    ];

    return { inline_keyboard: [...taskButtons, submitButton] };
}

// Helper function to create final check-in message
function createFinalCheckinMessage(user, checklist) {
    const completedTasksCount = checklist.tasks.filter((task) => task.completed).length;
    const totalTasksCount = checklist.tasks.length;
    const completionPercentage = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0;
    
    // 🆕 Free users don't see streak count
    const streakCount = hasStreaks(user) ? user.streak || 0 : 0;

    let message = `**Check-in Complete!** 🎉\n\n`;

    if (completionPercentage === 100) {
        message += `You crushed it! You completed **all ${totalTasksCount} tasks** today. `;
        message += hasStreaks(user) ? 'This is the consistency we\'re looking for! Keep it up! 💪' : 'Great job!';
    } else if (completionPercentage > 50) {
        message += `Great job! You completed **${completedTasksCount} out of ${totalTasksCount} tasks**. `;
        message += hasStreaks(user) ? 'You\'re building solid momentum. Let\'s get to 100% tomorrow!' : 'Keep going!';
    } else if (completionPercentage > 0) {
        message += `Alright, let's pick up the pace. You completed **${completedTasksCount} out of ${totalTasksCount} tasks**. `;
        message += hasStreaks(user) ? 'Don\'t let those goals slip away. Consistency is key! 😠' : 'You can do better tomorrow!';
    } else {
        message += `You completed **0 out of ${totalTasksCount} tasks**. I know it's tough, but you can't hit your goals if you don't even start. `;
        message += 'Get to work! 😤';
    }

    if (hasStreaks(user)) {
        message += `\n\nYour current streak is now at **${streakCount}** days.`;
    }

    return message;
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check AI usage and return model name or null
async function checkAIUsageAndGetModel(user, chatId, bot) {
    const hasAccess = await hasAIUsageAccess(user);
    if (!hasAccess) {
        if (isFreeUser(user)) {
            await sendTelegramMessage(
                bot,
                chatId,
                '🤖 AI Features are for subscribed users only!\n\n' +
                'Free users manually set their own tasks without AI assistance.\n\n' +
                '✨ Upgrade to Basic or Premium for:\n' +
                '• AI-powered task generation\n' +
                '• Smart goal validation\n' +
                '• Weekly/Monthly reflections\n' +
                '• Streak tracking & motivation\n\n' +
                'Type /subscription to upgrade!'
            );
        } else {
            await sendTelegramMessage(
                bot,
                chatId,
                '⚠️ You\'ve reached your AI limit. Upgrade your plan or wait for your usage to reset. Type /subscription to see available plans.'
            );
        }
        return null;
    }
    const model = user.gptVersion;
    if (!model) {
        await sendTelegramMessage(
            bot,
            chatId,
            "Your current plan doesn't support AI access. Upgrade to continue."
        );
        return null;
    }
    return model;
}

// Reminder / Mini Goal handler
async function handleReminder(user, userInput, bot, chatId) {
    if (user.pendingReminder && user.pendingReminder.waitingForTime) {
        const parsedTime = chrono.parseDate(userInput, new Date(), { timezone: TIMEZONE });

        if (!parsedTime || parsedTime < new Date()) {
            await sendTelegramMessage(
                bot,
                chatId,
                "⚠️ I couldn't understand that time or it's in the past. Please try again, e.g. *7:30am* or *14:00*."
            );
            return true;
        }

        const { task } = user.pendingReminder;
        const newReminder = new MiniGoal({
            userId: user._id,
            telegramId: user.telegramId,
            text: task,
            time: parsedTime,
        });

        await newReminder.save();
        user.pendingReminder = null;
        await user.save();

        await sendTelegramMessage(
            bot,
            chatId,
            `✅ Got it! I'll remind you to *${task}* at ${moment(parsedTime)
                .tz(TIMEZONE)
                .format('h:mm A')}.`
        );
        return true;
    }

    if (/remind/i.test(userInput)) {
        const parsedResult = chrono.parse(userInput, new Date(), { timezone: TIMEZONE });

        if (parsedResult && parsedResult.length > 0) {
            const parsedTime = parsedResult[0].start.date();
            const task = userInput
                .replace(/remind( me)?( to)?/i, '')
                .replace(parsedResult[0].text, '')
                .trim();

            if (!task || parsedTime < new Date()) {
                await sendTelegramMessage(
                    bot,
                    chatId,
                    "⚠️ I need both a task and a future time to set a reminder. What should I remind you to do?"
                );
                return true;
            }

            const newReminder = new MiniGoal({
                userId: user._id,
                telegramId: user.telegramId,
                text: task,
                time: parsedTime,
            });

            await newReminder.save();
            await sendTelegramMessage(
                bot,
                chatId,
                `✅ Great! I'll remind you to *${task}* at ${moment(parsedTime)
                    .tz(TIMEZONE)
                    .format('h:mm A')}.`
            );
            return true;
        } else {
            const task = userInput.replace(/^\s*remind( me)?( to)?\s*/i, '').trim();
            user.pendingReminder = { task, waitingForTime: true };
            await user.save();
            await sendTelegramMessage(
                bot,
                chatId,
                `⏰ What exact time should I remind you to *${task}*?`
            );
            return true;
        }
    }

    return false;
}

// Consolidate goal listing logic.
async function listUserGoals(bot, user, chatId) {
    const userGoals = await MiniGoal.find({ telegramId: user.telegramId }).sort({ time: 1 });
    let messageText = '📝 **Your Goals:**\n\n';

    if (user.goalMemory?.text) {
        messageText += `**Main Goal:**\n*${user.goalMemory.text}*\n\n`;
    } else {
        messageText += "You haven't set a main goal yet. Use `/setgoal` to define one.\n\n";
    }

    await sendTelegramMessage(bot, chatId, messageText);

    if (userGoals.length > 0) {
        await sendTelegramMessage(bot, chatId, '**Mini-Goals:**');
        for (const goal of userGoals) {
            const formattedTime = moment(goal.time).tz(TIMEZONE).format('h:mm A');
            const goalMessageText = `*${goal.text}* at ${formattedTime}`;
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✏️ Edit', callback_data: `editGoal|${goal._id}` },
                        { text: '🗑️ Delete', callback_data: `deleteGoal|${goal._id}` },
                    ],
                ],
            };
            await sendTelegramMessage(bot, chatId, goalMessageText, { reply_markup: keyboard });
        }
    } else {
        await sendTelegramMessage(bot, chatId, "You don't have any mini-goals yet. To set one, just say 'remind me to [task] at [time]'.");
    }
}

// 🆕 Function to handle free user manual task input
async function handleFreeUserTaskInput(user, userInput, bot, chatId) {
    const tasks = userInput.split('\n').map(task => task.trim()).filter(Boolean);
    
    const manualChecklist = {
        _id: new mongoose.Types.ObjectId(),
        weeklyGoal: user.goalMemory?.text || "Manual Goal",
        tasks: tasks.map(task => ({
            text: task,
            completed: false,
            _id: new mongoose.Types.ObjectId()
        })),
        checkedIn: false,
        date: moment().tz(TIMEZONE).startOf('day').toDate(),
        isManual: true
    };
    
    user.checklists.unshift(manualChecklist);
    user.pendingAction = null;
    await user.save();
    
    const messageText = `✅ Manual tasks set! Here's your checklist:\n\n${createChecklistMessage(manualChecklist)}`;
    const keyboard = createChecklistKeyboard(manualChecklist);
    
    await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
}

// Main message handler
async function handleMessage(bot, msg) {
    if (!msg || !msg.from || !msg.from.id || !msg.chat || !msg.chat.id) {
        console.error('❌ Invalid message format or missing chatId received:', msg);
        return;
    }

    const telegramId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const userInput = msg.text?.trim();

    try {
        if (!userInput) {
            await sendTelegramMessage(
                bot,
                chatId,
                'Sorry, I can only process text messages. Please try sending it again with words.'
            );
            return;
        }

        const user = await getOrCreateUser(telegramId);
        await handleDailyCheckinReset(user);

        const reminderHandled = await handleReminder(user, userInput, bot, chatId);
        if (reminderHandled) {
            return;
        }

        // 🆕 Handle free user manual task input
        if (isFreeUser(user) && user.pendingAction?.type === 'manual_tasks') {
            await handleFreeUserTaskInput(user, userInput, bot, chatId);
            return;
        }

        // Handle goal breakdown flow
        if (user.pendingAction && user.pendingAction.type === 'ai_goal_breakdown') {
            const currentStep = user.pendingAction.currentStep;
            
            if (currentStep === 'monthly_target') {
                // Store monthly target and move to weekly
                user.pendingAction.monthlyTarget = userInput;
                user.pendingAction.currentStep = 'weekly_milestone';
                await user.save();
                
                // Get AI suggestion for weekly milestone
                const weeklySuggestion = await getSmartResponse(user, 'goal_breakdown_suggestion', {
                    goalText: user.pendingAction.goalText,
                    breakdownType: 'weekly',
                    monthlyTarget: userInput
                });
                
                await sendTelegramMessage(
                    bot,
                    chatId,
                    `📅 Monthly target set! Now let's break it down weekly.\n\n` +
                    `💡 **AI Suggestion:** ${weeklySuggestion.suggestion}\n\n` +
                    `What's your weekly milestone toward this monthly target?`
                );
                return;
                
            } else if (currentStep === 'weekly_milestone') {
                // Complete the breakdown process
                user.goalMemory = {
                    text: user.pendingAction.goalText,
                    monthlyTarget: user.pendingAction.monthlyTarget,
                    weeklyTarget: userInput,
                    lastUpdated: new Date()
                };
                user.onboardingStep = 'onboarded';
                user.pendingAction = null;
                await user.save();
                
                await sendTelegramMessage(
                    bot,
                    chatId,
                    "✅ Perfect! Your goal breakdown is complete:\n\n" +
                    `🎯 **Main Goal:** ${user.goalMemory.text}\n` +
                    `📅 **Monthly Target:** ${user.goalMemory.monthlyTarget}\n` +
                    `📆 **Weekly Milestone:** ${user.goalMemory.weeklyTarget}\n\n` +
                    "Ready to get started? Use /checkin for your daily tasks."
                );
                return;
            }
        }

        if (user.pendingAction && user.pendingAction.type === 'editGoal') {
            const goalId = user.pendingAction.goalId;
            const parsedResult = chrono.parse(userInput, new Date(), { timezone: TIMEZONE });
            const parsedTime = parsedResult && parsedResult.length > 0 ? parsedResult[0].start.date() : null;
            const newText = parsedResult && parsedResult.length > 0 ? userInput.replace(parsedResult[0].text, '').trim() : userInput;

            if (!parsedTime && !newText) {
                await sendTelegramMessage(
                    bot,
                    chatId,
                    '⚠️ I couldn\'t understand the new task or time. Please provide a valid time and optionally new text.'
                );
                return;
            }

            const update = {};
            if (newText) {
                update.text = newText;
            }
            if (parsedTime) {
                update.time = parsedTime;
            }

            const updatedGoal = await MiniGoal.findByIdAndUpdate(goalId, update, { new: true });

            if (updatedGoal) {
                user.pendingAction = null;
                await user.save();
                await sendTelegramMessage(
                    bot,
                    chatId,
                    `✅ Your mini-goal has been updated to *${updatedGoal.text}* at ${moment(updatedGoal.time)
                        .tz(TIMEZONE)
                        .format('h:mm A')}.`
                );
            } else {
                await sendTelegramMessage(bot, chatId, '❌ The goal you were trying to edit was not found.');
            }
            return;
        }

        const command = userInput.toLowerCase().split(' ')[0];

        if (command === '/allowaccess') {
            if (msg.from.id.toString() !== ADMIN_TELEGRAM_ID) {
                return sendTelegramMessage(bot, chatId, '🚫 You are not authorized to use this command.');
            }
            const parts = userInput.split(' ');
            if (parts.length !== 3) {
                return sendTelegramMessage(bot, chatId, 'Usage: /allowaccess <telegramId> <plan>');
            }
            const targetTelegramId = parts[1];
            const plan = parts[2].toLowerCase();
            if (['premium', 'basic', 'pro', 'free'].includes(plan)) {
                try {
                    const updatedUser = await updateSubscription(targetTelegramId, plan);
                    if (updatedUser) {
                        await sendTelegramMessage(
                            bot,
                            chatId,
                            `✅ Successfully updated subscription for user ${targetTelegramId} to ${plan}.`
                        );
                        await sendTelegramMessage(
                            bot,
                            chatId,
                            `🎉 Congratulations! Your subscription has been manually updated to the **${plan}** plan. You now have full access to Focusly! Get started with /checkin.`
                        );
                    } else {
                        await sendTelegramMessage(bot, chatId, `User with ID ${targetTelegramId} not found.`);
                    }
                } catch (error) {
                    console.error('❌ Error with /allowaccess command:', error);
                    await sendTelegramMessage(bot, chatId, `❌ An error occurred while updating the subscription.`);
                }
            } else {
                await sendTelegramMessage(
                    bot,
                    chatId,
                    `Invalid plan. Please use 'premium', 'basic', 'pro', or 'free'.`
                );
            }
            return;
        }

        if (command === '/testbutton') {
            await sendTelegramMessage(bot, chatId, 'Click a button below:', {
                reply_markup: {
                    inline_keyboard: [[{ text: '✅ Test Callback', callback_data: 'test_callback' }]],
                },
            });
            return;
        }

        if (command === '/start') {
            if (user.onboardingStep === 'awaiting_goal') {
                return sendTelegramMessage(
                    bot,
                    chatId,
                    `Hi ${msg.from.first_name}! 👋 Welcome to Focusly. Let's start with your first weekly goal. What's one thing you want to achieve this week?`
                );
            } else if (user.onboardingStep !== 'onboarded') {
                user.onboardingStep = 'awaiting_goal';
                await user.save();
                return sendTelegramMessage(
                    bot,
                    chatId,
                    `Hi ${msg.from.first_name}! 👋 Welcome to Focusly. Let's start with your first weekly goal. What's one thing you want to achieve this week?`
                );
            } else {
                return sendTelegramMessage(
                    bot,
                    chatId,
                    `Welcome back, ${msg.from.first_name}! You've already started. Use the /checkin command to get your checklist.`
                );
            }
        }

        if (command === '/subscription') {
            const now = moment().tz(TIMEZONE).toDate();
            const isExpired = user.subscriptionEndDate && user.subscriptionEndDate < now;
            const isActive = user.subscriptionStatus === 'active' && !isExpired;

            if (isActive) {
                let planMessage = `You are currently on the **${user.subscriptionPlan}** plan`;
                
                if (user.subscriptionEndDate) {
                    planMessage += `, which expires on **${moment(user.subscriptionEndDate)
                        .tz(TIMEZONE)
                        .format('LL')}**`;
                }
                
                planMessage += '. Thank you for your continued support!';
                
                await sendTelegramMessage(bot, chatId, planMessage);
            } else {
                await sendSubscriptionOptions(bot, chatId, isPremiumUser(user), sendTelegramMessage);
            }
            return;
        }

        if (command === '/checkin') {
            if (!user.goalMemory || !user.goalMemory.text) {
                return sendTelegramMessage(
                    bot,
                    chatId,
                    "You don't have a goal set yet! Use `/start` or `/setgoal` to define your weekly goal."
                );
            }

            // 🆕 FREE USER: Manual task setting
            if (isFreeUser(user)) {
                await sendTelegramMessage(
                    bot,
                    chatId,
                    "📋 Free Plan - Manual Mode\n\n" +
                    "Please set your daily tasks manually. Send your tasks (one per line):\n\n" +
                    "Example:\n" +
                    "Complete project report\n" +
                    "Gym workout for 30 mins\n" +
                    "Read chapter 5 of my book\n\n" +
                    "💡 Upgrade to Basic for AI-powered automatic task generation!"
                );
                user.pendingAction = { type: 'manual_tasks' };
                await user.save();
                return;
            }

            // BASIC/PREMIUM: AI-powered checklist
            const today = moment().tz(TIMEZONE).startOf('day').toDate();
            const checklist = await getChecklistByDate(user.telegramId, today);

            if (checklist) {
                if (checklist.checkedIn) {
                    const finalMessage = createFinalCheckinMessage(user, checklist);
                    return sendTelegramMessage(bot, chatId, finalMessage);
                } else {
                    const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${user.goalMemory.text}\n\n` +
                        createChecklistMessage(checklist);
                    const keyboard = createChecklistKeyboard(checklist);
                    return sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                }
            } else {
                const model = await checkAIUsageAndGetModel(user, chatId, bot);
                if (!model) return;

                const aiResponse = await getSmartResponse(user, 'create_checklist', {
                    goalMemory: user.goalMemory,
                });

                if (aiResponse.intent === 'create_checklist' && aiResponse.daily_tasks && aiResponse.daily_tasks.length > 0) {
                    const newChecklist = await createAndSaveChecklist(user.telegramId, aiResponse);
                    const messageText = `Got it. Here is your daily checklist to get you started:\n\n**Weekly Goal:** ${newChecklist.weeklyGoal}\n\n` +
                        createChecklistMessage(newChecklist);
                    const keyboard = createChecklistKeyboard(newChecklist);
                    await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                    await trackAIUsage(user, 'checklist');
                } else {
                    await sendTelegramMessage(
                        bot,
                        chatId,
                        "I couldn't create a checklist based on your goal. Can you try setting a more specific goal?"
                    );
                }
            }
            return;
        }

        if (command === '/setgoal') {
            const newGoalText = userInput.replace(/^\s*\/\w+\s*/, '').trim();
            if (!newGoalText) {
                return sendTelegramMessage(
                    bot,
                    chatId,
                    "Please provide a goal to set. Example: `/setgoal Learn to code in Python`"
                );
            }

            // 🆕 FREE USER: Manual goal setting
            if (isFreeUser(user)) {
                user.goalMemory = {
                    text: newGoalText,
                    lastUpdated: new Date()
                };
                user.onboardingStep = 'onboarded';
                await user.save();
                
                await sendTelegramMessage(
                    bot,
                    chatId,
                    "✅ Goal set manually. As a free user, you'll need to create your own daily tasks.\n\n" +
                    "💡 Upgrade to Basic or Premium for:\n" +
                    "• AI-powered goal breakdowns\n" +
                    "• Automatic daily task generation\n" +
                    "• Timeline validation\n" +
                    "• Weekly/Monthly reflections\n" +
                    "• Streak tracking & motivation\n\n" +
                    "Type /subscription to upgrade!"
                );
                return;
            }

            const model = await checkAIUsageAndGetModel(user, chatId, bot);
            if (!model) return;

            // Step 1: Get the AI to extract the goal and timeline
            const aiExtraction = await getSmartResponse(user, 'set_goal', { userInput: newGoalText });
            await trackAIUsage(user, 'general');

            const goalText = aiExtraction.goal_text || newGoalText;
            const timeline = aiExtraction.timeline;

            // Step 2: Manually parse and validate the timeline
            let isTimelineRealistic = true;
            let timelineInDays = Infinity;

            if (timeline) {
                const parsedTimeline = chrono.parse(timeline, new Date(), { timezone: TIMEZONE });
                if (parsedTimeline.length > 0) {
                    const endDate = parsedTimeline[0].start.date();
                    const diffInMs = endDate.getTime() - new Date().getTime();
                    timelineInDays = diffInMs / (1000 * 60 * 60 * 24);

                    if (timelineInDays < 7) {
                        isTimelineRealistic = false;
                    }
                } else {
                    isTimelineRealistic = false;
                }
            }

            // Step 3: Branch the logic based on timeline realism
            if (!isTimelineRealistic) {
                const aiCritique = await getSmartResponse(user, 'goal_critique', { goalText });
                await trackAIUsage(user, 'general');
                await sendTelegramMessage(bot, chatId, aiCritique.message);
                return;
            }

            // Step 4: If timeline is realistic, save the goal and generate the checklist
            user.goalMemory = {
                text: goalText,
                lastUpdated: new Date()
            };
            user.onboardingStep = 'onboarded';
            await user.save();

            // Generate checklist after successful goal setting
            const aiChecklistResponse = await getSmartResponse(user, 'create_checklist', {
                goalMemory: user.goalMemory,
            });

            if (aiChecklistResponse.intent === 'create_checklist' && aiChecklistResponse.daily_tasks && aiChecklistResponse.daily_tasks.length > 0) {
                const newChecklist = await createAndSaveChecklist(user.telegramId, aiChecklistResponse);
                const messageText = `✅ Got it! Your new weekly goal is: *${newChecklist.weeklyGoal}*. Let's break it down.\n\n` +
                    `Here is your first daily checklist:\n\n` +
                    createChecklistMessage(newChecklist);
                const keyboard = createChecklistKeyboard(newChecklist);
                await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                await trackAIUsage(user, 'checklist');
            } else {
                await sendTelegramMessage(
                    bot,
                    chatId,
                    "I've set your goal, but I couldn't create a checklist for it. Let's try again with the /checkin command."
                );
            }
            return;
        }

        if (command === '/remember') {
            const textToRemember = userInput.replace('/remember', '').trim();
            if (textToRemember) {
                await addImportantMemory(user, textToRemember);
                await sendTelegramMessage(bot, chatId, "Got it. I've added that to your long-term memory.");
            } else {
                await sendTelegramMessage(
                    bot,
                    chatId,
                    'What should I remember? Use the command like this: /remember [your important note]'
                );
            }
            return;
        }

        if (command === '/goals') {
            await listUserGoals(bot, user, chatId);
            return;
        }

        if (user && user.onboardingStep === 'awaiting_goal') {
            if (userInput && userInput.length > 5) {
                user.goalMemory = {
                    text: userInput,
                    lastUpdated: new Date()
                };
                user.onboardingStep = 'onboarded';
                await user.save();
                
                // 🆕 Different message for free users
                if (isFreeUser(user)) {
                    await sendTelegramMessage(
                        bot,
                        chatId,
                        "✅ Goal set manually! You'll need to create your own daily tasks.\n\n" +
                        "Use /checkin to set your tasks for today.\n\n" +
                        "💡 Upgrade for AI-powered task generation and smart features!"
                    );
                } else {
                    await sendTelegramMessage(
                        bot,
                        chatId,
                        "Awesome! I've set your weekly goal. I'll send you a daily checklist to help you stay on track. Just type /checkin when you're ready to see it."
                    );
                }
            } else {
                await sendTelegramMessage(
                    bot,
                    chatId,
                    "Please provide a more detailed goal. What's one thing you want to achieve this week?"
                );
            }
            return;
        }

        // --- AI-powered conversational intent handling ---
        // 🆕 FREE USERS: Block AI access
        if (isFreeUser(user)) {
            await sendTelegramMessage(
                bot,
                chatId,
                "🤖 AI Features are for subscribed users only!\n\n" +
                "Free users manually set their own tasks without AI assistance.\n\n" +
                "✨ Upgrade to Basic or Premium for:\n" +
                "• AI-powered conversations\n" +
                "• Smart goal guidance\n" +
                "• Strategy recommendations\n" +
                "• Behavioral insights\n\n" +
                "Type /subscription to upgrade!"
            );
            return;
        }

        const model = await checkAIUsageAndGetModel(user, chatId, bot);
        if (!model) return;

        await addRecentChat(user, userInput);

        const aiResponse = await getSmartResponse(user, 'conversational_intent', { userInput });

        // Handle guidance requests
        if (aiResponse.intent === 'request_guidance') {
            const guidanceResponse = await getSmartResponse(user, 'task_guidance', {
                goalText: user.goalMemory?.text,
                taskContext: aiResponse.task_context || userInput
            });
            
            await sendTelegramMessage(bot, chatId, guidanceResponse.message);
            await trackAIUsage(user, 'guidance');
            return;
        }

        // Handle strategy discussions
        if (aiResponse.intent === 'discuss_strategy') {
            const strategyResponse = await getSmartResponse(user, 'goal_strategy', {
                goalText: user.goalMemory?.text,
                goalAspect: aiResponse.goal_aspect || "general strategy"
            });
            
            await sendTelegramMessage(bot, chatId, strategyResponse.message);
            await trackAIUsage(user, 'strategy');
            return;
        }

        if (aiResponse.intent === 'list_mini_goals' || aiResponse.intent === 'list_all_goals') {
            await listUserGoals(bot, user, chatId);
            await trackAIUsage(user, 'general');
            return;
        } else if (aiResponse.intent === 'create_checklist') {
            if (aiResponse.challenge_message) {
                await sendTelegramMessage(bot, chatId, aiResponse.challenge_message);
                await delay(1500);
            }
            if (aiResponse.daily_tasks && aiResponse.daily_tasks.length > 0) {
                const newChecklist = await createAndSaveChecklist(user.telegramId, aiResponse);
                const messageText = `Got it. Here is your daily checklist to get you started:\n\n**Weekly Goal:** ${newChecklist.weeklyGoal}\n\n` +
                    createChecklistMessage(newChecklist);
                const keyboard = createChecklistKeyboard(newChecklist);
                await sendTelegramMessage(bot, chatId, messageText, { reply_markup: keyboard });
                await trackAIUsage(user, 'checklist');
            } else {
                await sendTelegramMessage(
                    bot,
                    chatId,
                    "I couldn't create a checklist based on that. Can you be more specific?"
                );
            }
        } else if (aiResponse.message) {
            await sendTelegramMessage(bot, chatId, aiResponse.message);
            await trackAIUsage(user, 'general');
        } else {
            await sendTelegramMessage(
                bot,
                chatId,
                "I'm sorry, I don't understand that. Please focus on your current goal and use the /checkin command when you're ready."
            );
        }
    } catch (error) {
        console.error('❌ Error handling message:', error);
        await sendTelegramMessage(
            bot,
            chatId,
            'Something went wrong while processing your message. Please try again.'
        );
    }
}

module.exports = {
    handleMessage,
    createChecklistMessage,
    createChecklistKeyboard,
    createFinalCheckinMessage,
    sendTelegramMessage,
};