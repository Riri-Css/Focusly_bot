// File: src/utils/cronJobs.js - CONSOLIDATED & CORRECTED

const cron = require('node-cron');
const moment = require('moment-timezone');
const User = require('../models/user');
const MiniGoal = require('../models/miniGoal');
const { sendTelegramMessage } = require('../handlers/messageHandlers');
const { getSmartResponse } = require('./getSmartResponse');
const { createAndSaveChecklist, getChecklistByDate } = require('../controllers/userController');
const { createChecklistMessage, createChecklistKeyboard } = require('../handlers/messageHandlers');

const TIMEZONE = 'Africa/Lagos';

function startDailyJobs(bot) {
    // ⏰ Mini-Goal Reminder Check
    // This runs every minute to check for any goals that are due.
    cron.schedule('* * * * *', async () => {
        console.log('⏰ Checking for due mini-goals...');
        try {
            const now = moment().tz(TIMEZONE).toDate();

            // Find mini-goals that are due and haven't been reminded yet
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
                    // Mark the goal as reminded
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
    // This runs just after midnight to handle end-of-day logistics.
    cron.schedule('1 0 * * *', async () => {
        console.log('⏰ Running daily reset and streak calculation job...');
        try {
            const users = await User.find({});
            for (const user of users) {
                // Find and reset the last AI usage record
                const today = moment().tz(TIMEZONE).startOf('day').toDate();
                user.aiUsage = user.aiUsage.filter(record => moment(record.date).isSameOrAfter(today));

                // Reset hasSubmittedTasksToday and hasCheckedInTonight for the new day
                user.hasSubmittedTasksToday = false;
                user.hasCheckedInTonight = false;

                // Daily streaks are now handled by the 'submitCheckin' function
                // This job is just for clean-up
                
                await user.save();
            }
            console.log(`✅ Completed daily reset for all users.`);
        } catch (err) {
            console.error('❌ 12:01 AM daily reset cron error:', err.message);
        }
    }, { timezone: TIMEZONE });


    // ⏰ 8 AM Daily Checklist Generator
    // This job is now the only one that automatically creates a checklist.
    cron.schedule('0 8 * * *', async () => {
        console.log('⏰ Running 8 AM daily checklist generator...');
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

                    const aiResponse = await getSmartResponse(user, 'create_checklist', { goalMemory: user.goalMemory });

                    if (aiResponse.intent === 'create_checklist' && aiResponse.daily_tasks && aiResponse.daily_tasks.length > 0) {
                        const newChecklist = await createAndSaveChecklist(user.telegramId, aiResponse);
                        const messageText = `Good morning! Here is your daily checklist to push you towards your goal:\n\n**Weekly Goal:** ${newChecklist.weeklyGoal}\n\n` + createChecklistMessage(newChecklist);
                        const keyboard = createChecklistKeyboard(newChecklist);
                        await sendTelegramMessage(bot, user.telegramId, messageText, { reply_markup: keyboard });
                        console.log(`✅ Sent 8 AM checklist to user ${user.telegramId}`);
                    } else {
                        await sendTelegramMessage(bot, user.telegramId, `I couldn't generate a checklist for you today. Let's re-examine your goal. Use the command /setgoal to update your goal.`);
                        console.log(`⚠️ Failed to generate 8 AM checklist for user ${user.telegramId}`);
                    }
                } catch (err) {
                    console.error(`❌ Error processing checklist for user ${user.telegramId}:`, err);
                }
            }
        } catch (err) {
            console.error('❌ 8 AM daily checklist cron error:', err);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 12 PM Progress Reminder
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

    // ⏰ 3 PM Progress Reminder
    cron.schedule('0 15 * * *', async () => {
        console.log('⏰ Running 3 PM progress reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
            if (user.goalMemory) {
                await sendTelegramMessage(bot, user.telegramId, "It’s 3 PM! How’s your day going? Have you made progress on your tasks? At least by now you suppose dey round up o make you sef rest but na only if you don do something progressive.");
                console.log(`✅ Sent 3 PM reminder to user ${user.telegramId}`);
            }
        }
    }, { timezone: TIMEZONE });

    // ⏰ 6 PM Progress Reminder
    cron.schedule('0 18 * * *', async () => {
        console.log('⏰ Running 6 PM progress reminder...');
        const users = await User.find({ hasCheckedInTonight: false });
        for (const user of users) {
            if (user.goalMemory) {
                await sendTelegramMessage(bot, user.telegramId, "It’s 6 PM! How’s your evening going? Hope you're almost done with your tasks because excuses will not be accepted. I just make I yarn you and if you come with excuse, me sef dey gidigba for you!");
                console.log(`✅ Sent 6 PM reminder to user ${user.telegramId}`);
            }
        }
    }, { timezone: TIMEZONE });

    // ⏰ 9 PM Dedicated Check-in Reminder
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

    // --- NEW WEEKLY REFLECTION JOB (Sunday at 9 PM) ---
    cron.schedule('0 21 * * 0', async () => {
        console.log('⏰ Running weekly reflection job...');
        try {
            const users = await User.find();
            for (const user of users) {
                const last7DaysChecklists = user.checklists
                    .filter(c => moment(c.date).isAfter(moment().subtract(7, 'days')));

                if (last7DaysChecklists.length > 0) {
                    const completedTasksCount = last7DaysChecklists.reduce((sum, checklist) =>
                        sum + checklist.tasks.filter(task => task.completed).length, 0);
                    const totalTasksCount = last7DaysChecklists.reduce((sum, checklist) =>
                        sum + checklist.tasks.length, 0);

                    const checkinsCount = last7DaysChecklists.filter(c => c.checkedIn).length;
                    const missedCheckins = 7 - checkinsCount;

                    let reflectionMessage = "";

                    if (missedCheckins > checkinsCount) {
                        // Strict tone
                        reflectionMessage = `
⚠️ **Weekly Reflection**
This week you completed **${completedTasksCount}/${totalTasksCount}** tasks,
but you *missed more check-ins than you made*.  

That’s not good enough if you’re serious about your achievement. Despite all my reminders and text messages, you still came out like this, I'm so disappointed to even be acquainted with you.
so which means all of my messages, you're just like "what's all these unnecessary messages?" no problem na, i'll still try  my best so at the end of your goal duration, i can say "I TOLD YOU SO!" 
that's if you still keep up with this attitude but i know there's still room for  change and you're not exempted.
Here’s what to do next week:
1. Keep your goals smaller but consistent.  
2. Check in **every day** — no excuses.  
3. Hold yourself accountable like it’s a real deadline. 
4. If there's anywhere you're struggling with, don't hesitate to reach out.

Next week, I expect better discipline. 🚀
                    `;
                    } else {
                        // Encouraging tone
                        reflectionMessage = `
✅ **Weekly Reflection**
This week you completed **${completedTasksCount}/${totalTasksCount}** tasks,
and checked in more times than you missed.  Damnnn, that's some bold move and I really love that can't believe this is you!!
Please hold on to whatever strategy helped you stay consistent this week even if it's your Ex.

Great job staying consistent! Keep the momentum:
1. Build on what worked this week.  
2. Stretch your goals slightly to challenge yourself.  
3. Stay consistent — success compounds!  

I’m proud of your discipline. Keep pushing 💪
                    `;
                    }

                    await sendTelegramMessage(bot, user.telegramId, reflectionMessage);
                    console.log(`✅ Sent weekly reflection to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ Weekly reflection cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // --- NEW MONTHLY REFLECTION JOB (First day of the month at 9 AM) ---
    cron.schedule('0 9 1 * *', async () => {
        console.log('⏰ Running monthly reflection job...');
        try {
            const users = await User.find();
            for (const user of users) {
                const startOfMonth = moment().tz(TIMEZONE).startOf('month');
                const thisMonthChecklists = user.checklists.filter(c =>
                    moment(c.date).isSameOrAfter(startOfMonth)
                );
                
                if (thisMonthChecklists.length > 0) {
                    const completedTasksCount = thisMonthChecklists.reduce((sum, checklist) =>
                        sum + checklist.tasks.filter(task => task.completed).length, 0
                    );
                    const totalTasksCount = thisMonthChecklists.reduce((sum, checklist) =>
                        sum + checklist.tasks.length, 0
                    );
                    const totalCheckins = thisMonthChecklists.filter(c => c.checkedIn).length;
                    const achievements = user.importantMemories.length; // Use importantMemories for 'achievements'
                    
                    // You'll need to define what 'leftToAchieve' means for your bot
                    // For now, I've set it to the total tasks minus completed tasks
                    const leftToAchieve = totalTasksCount - completedTasksCount;

                    let reflectionMessage;
                    if (completedTasksCount === 0) {
                        reflectionMessage = `
⚠️ **Monthly Reflection**
This month you had **${totalCheckins}** check-ins. 
Honestly? You’ve been ghosting your own goals more than showing up. 

I won’t sugarcoat it: if you keep this same “I’ll do it later” energy, you’ll blink and your **${user.goalMemory?.text || 'goal'}** will still be sitting in drafts while others are living it. 
The only thing standing between you and your goal is action. The only thing stopping you from achieving **${user.goalMemory?.text || 'your goal'}** is the amount of work and consistency you're willing to put.

But hey — it’s not over yet. You’ve already achieved **${achievements}** things. What’s left? Just **${leftToAchieve}** more steps standing between you and your end goal. 

Next month, no more vibes-only mode: 
1. Show up **daily** (even on “not in the mood” days). 
2. Stop waiting for motivation, act first — motivation follows. 
3. Remember why you even set this goal. This should even be no 1 because that's the only thing that'll keep you going when the drive isn't there anymore. 

This is your wake-up call 🚨 — are you going to prove me wrong, or prove me right?`;
                    } else {
                        reflectionMessage = `
This month you showed up **${totalCheckins}** times. 
That’s the energy I’m talking about 🔥. 

You’ve already crushed **${achievements}** milestones. What’s left? Just **${leftToAchieve}** more steps standing between you and your **${user.goalMemory?.text || 'goal'}**. 

Your consistency is screaming main-character energy 💅. Keep stacking these wins and by the time your goal duration ends, you’ll look back and be like, “damnnnn, I really did that. Kimon.” 

Next month, let’s push it even harder: 
1. Lock in your daily streak like your life depends on it. 
2. Celebrate your small wins, no matter how small, they’re proof you’re unstoppable. 
3. Double down on discipline, because discipline > vibes. 

Proud of you. Keep proving yourself right 🌟.`;
                    }

                    await sendTelegramMessage(bot, user.telegramId, reflectionMessage);
                    console.log(`✅ Sent monthly reflection to user ${user.telegramId}`);
                }
            }
        } catch (err) {
            console.error('❌ Monthly reflection cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ 11:59 PM Daily Check-in Reminder
    cron.schedule('30 23 * * *', async () => {
        console.log('⏰ Running 11:59 PM check-in reminder...');
        try {
            const users = await User.find({ hasCheckedInTonight: false });
            for (const user of users) {
                if (user.goalMemory) {
                    const today = moment().tz(TIMEZONE).startOf('day').toDate();
                    const checklist = await getChecklistByDate(user.telegramId, today);
                    if (checklist && !checklist.checkedIn) {
                        const message = `
🚨 Final Reminder! 🚨

It's almost midnight. You have less than an hour to check in for today to keep your streak alive!

Kindly click on tasks you did today and submit yor checklist.
`;
                        await sendTelegramMessage(bot, user.telegramId, message);
                    }
                }
            }
        } catch (err) {
            console.error('❌ 11:59 PM reminder cron error:', err.message);
        }
    }, { timezone: TIMEZONE });

    // ⏰ Daily AI Usage Reset (Separate to avoid confusion with streaks)
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

}

module.exports = { startDailyJobs };
