// File: src/controllers/userController.js - UPDATED FOR TIER SUPPORT
const User = require('../models/user');
const moment = require('moment-timezone');
const mongoose = require('mongoose');
const { isFreeUser } = require('../utils/subscriptionUtils'); // 🆕 Import tier check

const TIMEZONE = 'Africa/Lagos';

/**
 * Retrieves a user from the database or creates a new one if they don't exist.
 * @param {string} telegramId The unique ID of the user on Telegram.
 * @returns {Promise<User>} The user document.
 */
async function getOrCreateUser(telegramId) {
    try {
        // Use findOneAndUpdate with upsert to avoid race conditions
        let user = await User.findOneAndUpdate(
            { telegramId: telegramId },
            { 
                $setOnInsert: {
                    telegramId: telegramId,
                    streak: 0,
                    lastCheckin: null,
                    goalMemory: { text: null },
                    checklists: [],
                    lastCheckinDate: null,
                    consecutiveChecks: 0,
                    subscriptionStatus: 'trialing',
                    subscriptionPlan: 'free-trial', 
                    subscriptionEndDate: moment().tz(TIMEZONE).add(8, 'days').toDate(),
                    aiUsage: [], 
                    onboardingStep: 'awaiting_goal',
                    recentChats: [],
                    importantMemories: [],
                }
            },
            { 
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        if (!user) {
            console.error('Failed to get or create user:', telegramId);
            return null;
        }

        // Handle migrations and corrections on the fresh document
        if (user.onboardingStep === 'start') {
            user.onboardingStep = 'awaiting_goal';
            await user.save();
        }

        // Ensure arrays exist
        if (!user.aiUsage || !Array.isArray(user.aiUsage)) {
            user.aiUsage = [];
        }
        if (!user.recentChats) {
            user.recentChats = [];
        }
        if (!user.importantMemories) {
            user.importantMemories = [];
        }
        if (!user.onboardingStep) {
            user.onboardingStep = 'awaiting_goal';
        }
        if (!user.goalMemory) {
            user.goalMemory = { text: null };
        }

        return user;
    } catch (error) {
        console.error("❌ Error in getOrCreateUser:", error);
        return null;
    }
}

/**
 * Refresh a user document to avoid version conflicts
 * @param {User} user The user document to refresh
 * @returns {Promise<User|null>} The refreshed user document
 */
async function refreshUser(user) {
    if (!user || !user._id) {
        return null;
    }
    
    try {
        return await User.findById(user._id);
    } catch (error) {
        console.error("❌ Error refreshing user:", error);
        return null;
    }
}

/**
 * Creates and saves a new checklist for a user, including any uncompleted tasks from yesterday.
 * @param {string} telegramId The unique ID of the user on Telegram.
 * @param {object} aiResponse The AI response object containing the checklist data.
 * @returns {Promise<Object|null>} The newly created checklist or null if an error occurs.
 */
async function createAndSaveChecklist(telegramId, aiResponse) {
    try {
        const user = await getOrCreateUser(telegramId);
        if (!user) {
            console.error(`User with ID ${telegramId} not found.`);
            return null;
        }

        // Refresh user to avoid version conflicts
        const refreshedUser = await refreshUser(user);
        if (!refreshedUser) return null;

        const today = moment().tz(TIMEZONE).startOf('day').toDate();
        if (refreshedUser.checklists.find(c => moment(c.date).tz(TIMEZONE).isSame(today, 'day'))) {
            console.warn(`Attempted to create duplicate checklist for user ${telegramId} on ${today}`);
            return refreshedUser.checklists.find(c => moment(c.date).tz(TIMEZONE).isSame(today, 'day'));
        }

        const yesterday = moment().tz(TIMEZONE).subtract(1, 'day').startOf('day').toDate();
        const yesterdayChecklist = refreshedUser.checklists.find(c => moment(c.date).tz(TIMEZONE).isSame(yesterday, 'day'));
        const uncompletedTasks = (yesterdayChecklist?.tasks || []).filter(task => !task.completed);
        
        const newTasks = uncompletedTasks.map(task => ({
            text: task.text + " (from yesterday)",
            _id: new mongoose.Types.ObjectId(),
            completed: false,
            isCarriedOver: true
        })).concat(aiResponse.daily_tasks.map(task => ({
            ...task,
            _id: new mongoose.Types.ObjectId(),
            completed: false,
            isCarriedOver: false
        })));

        const newChecklist = {
            _id: new mongoose.Types.ObjectId(), 
            weeklyGoal: aiResponse.weekly_goal || refreshedUser.goalMemory.text,
            tasks: newTasks,
            checkedIn: false,
            date: today
        };
        
        refreshedUser.checklists.unshift(newChecklist);
        await refreshedUser.save();
        return newChecklist;

    } catch (error) {
        console.error('Error creating and saving checklist:', error);
        throw error;
    }
}

/**
 * Creates a manual checklist for free users
 * @param {string} telegramId The user's Telegram ID.
 * @param {Array} tasks Array of task strings.
 * @returns {Promise<Object|null>} The created checklist or null if error.
 */
async function createManualChecklist(telegramId, tasks) {
    try {
        const user = await getOrCreateUser(telegramId);
        if (!user) {
            console.error(`User with ID ${telegramId} not found.`);
            return null;
        }

        const refreshedUser = await refreshUser(user);
        if (!refreshedUser) return null;

        const today = moment().tz(TIMEZONE).startOf('day').toDate();
        
        // Remove any existing manual checklist for today
        refreshedUser.checklists = refreshedUser.checklists.filter(
            c => !(moment(c.date).tz(TIMEZONE).isSame(today, 'day') && c.isManual)
        );

        const manualChecklist = {
            _id: new mongoose.Types.ObjectId(),
            weeklyGoal: refreshedUser.goalMemory?.text || "Manual Goal",
            tasks: tasks.map(task => ({
                text: task,
                completed: false,
                _id: new mongoose.Types.ObjectId()
            })),
            checkedIn: false,
            date: today,
            isManual: true
        };

        refreshedUser.checklists.unshift(manualChecklist);
        await refreshedUser.save();
        return manualChecklist;

    } catch (error) {
        console.error('Error creating manual checklist:', error);
        throw error;
    }
}

/**
 * Retrieves a checklist by its date for a specific user.
 * @param {string} telegramId The user's Telegram ID.
 * @param {Date} dateObj The date object to search for.
 * @returns {Promise<Object|null>} The checklist object or null if not found.
 */
async function getChecklistByDate(telegramId, dateObj) {
    try {
        const user = await getOrCreateUser(telegramId);
        if (!user) {
            return null;
        }
        const targetDate = moment(dateObj).tz(TIMEZONE).startOf('day').toDate();
        return user.checklists.find(c => moment(c.date).tz(TIMEZONE).isSame(targetDate, 'day'));
    } catch (error) {
        console.error("❌ Error fetching checklist by date:", error);
        return null;
    }
}

/**
 * Handles the daily check-in reset logic for streak management.
 * This function should be called at the start of a user's day to update their state.
 * @param {User} user The user document.
 */
async function handleDailyCheckinReset(user) {
    if (!user) {
        console.error("User object is null, cannot handle daily check-in.");
        return;
    }

    try {
        // Refresh the user to avoid version conflicts
        const refreshedUser = await refreshUser(user);
        if (!refreshedUser) return;

        const now = moment().tz(TIMEZONE);
        const todayStart = now.clone().startOf('day');

        if (refreshedUser.lastCheckinDate) {
            const lastCheckinMoment = moment(refreshedUser.lastCheckinDate).tz(TIMEZONE);
            const isYesterday = lastCheckinMoment.isSame(todayStart.clone().subtract(1, 'day'), 'day');
            const isToday = lastCheckinMoment.isSame(todayStart, 'day');
            
            if (!isYesterday && !isToday) {
                console.log(`❌ User ${refreshedUser.telegramId} missed check-in. Streak reset.`);
                // 🆕 Only reset streak for non-free users
                if (!isFreeUser(refreshedUser)) {
                    refreshedUser.streak = 0;
                }
                await refreshedUser.save();
            }
        }
    } catch (error) {
        console.error("❌ Error handling daily check-in reset:", error);
    }
}

/**
 * Updates a checklist for a user.
 * @param {string} telegramId The user's Telegram ID.
 * @param {object} updatedChecklist The new checklist object.
 * @returns {Promise<Object|null>} The updated checklist or null if an error occurs.
 */
async function updateChecklist(telegramId, updatedChecklist) {
    try {
        const user = await getOrCreateUser(telegramId);
        if (!user) {
            console.error("User not found, cannot update checklist.");
            return null;
        }
        
        // Refresh user to avoid version conflicts
        const refreshedUser = await refreshUser(user);
        if (!refreshedUser) return null;

        const checklistIndex = refreshedUser.checklists.findIndex(c => c._id.toString() === updatedChecklist._id.toString());
        if (checklistIndex !== -1) {
            refreshedUser.checklists[checklistIndex] = updatedChecklist;
            await refreshedUser.save();
            return refreshedUser.checklists[checklistIndex];
        } else {
            console.error(`Checklist with ID ${updatedChecklist._id} not found for user ${telegramId}.`);
            return null;
        }
    } catch (error) {
        console.error("❌ Error updating checklist:", error);
        return null;
    }
}

/**
 * Retrieves a checklist by its ID for a specific user.
 * @param {string} telegramId The user's Telegram ID.
 * @param {string} checklistId The ID of the checklist.
 * @returns {Promise<Object|null>} The checklist object or null if not found.
 */
async function getChecklistById(telegramId, checklistId) {
    try {
        const user = await getOrCreateUser(telegramId);
        if (!user) {
            return null;
        }
        return user.checklists.find(c => c._id.toString() === checklistId);
    } catch (error) {
        console.error("❌ Error fetching checklist by ID:", error);
        return null;
    }
}

/**
 * Toggles the completion status of a task in a user's checklist.
 * @param {string} telegramId The user's Telegram ID.
 * @param {string} checklistId The ID of the checklist.
 * @param {number} taskIndex The index of the task to toggle.
 * @returns {Object|null} The updated checklist or null if not found.
 */
async function toggleTaskCompletion(telegramId, checklistId, taskIndex) {
    try {
        const user = await getOrCreateUser(telegramId);
        if (!user) {
            return null;
        }
        
        // Refresh user to avoid version conflicts
        const refreshedUser = await refreshUser(user);
        if (!refreshedUser) return null;

        const checklist = refreshedUser.checklists.find(c => c._id.toString() === checklistId);
        if (!checklist) {
            console.error(`Checklist not found with ID: ${checklistId}`);
            return null;
        }
        if (checklist.tasks[taskIndex]) {
            checklist.tasks[taskIndex].completed = !checklist.tasks[taskIndex].completed;
            await refreshedUser.save();
            return checklist;
        } else {
            console.error(`Task index ${taskIndex} not found in checklist ${checklistId}`);
            return null;
        }
    } catch (error) {
        console.error("❌ Error toggling task completion:", error);
        return null;
    }
}

/**
 * Updates the user's streak and last checkin date, then returns the updated user object.
 * @param {User} user The user document.
 * @param {string} checklistId The ID of the checklist being submitted.
 * @returns {Promise<User|null>} The updated user object or null if an error occurs.
 */
async function submitCheckin(user, checklistId) {
    if (!user) {
        return null;
    }

    try {
        // Refresh the user to avoid version conflicts
        const refreshedUser = await refreshUser(user);
        if (!refreshedUser) return null;

        const checklist = refreshedUser.checklists.find(c => c._id.toString() === checklistId);
        if (!checklist) {
            return null;
        }

        if (checklist.checkedIn) {
            return refreshedUser; // Already checked in today
        }

        const todayStart = moment().tz(TIMEZONE).startOf('day');
        const lastCheckinDate = refreshedUser.lastCheckinDate
            ? moment(refreshedUser.lastCheckinDate).tz(TIMEZONE).startOf('day')
            : null;

        // 🆕 Only update streak for non-free users
        if (!isFreeUser(refreshedUser)) {
            if (!lastCheckinDate) {
                // First check-in ever
                refreshedUser.streak = 1;
            } else {
                const diff = todayStart.diff(lastCheckinDate, 'days');

                if (diff === 0) {
                    // Already checked in today
                    return refreshedUser;
                } else if (diff === 1) {
                    // Consecutive day → increment streak
                    refreshedUser.streak = (refreshedUser.streak || 0) + 1;
                } else {
                    // Missed at least one day → reset streak
                    refreshedUser.streak = 1;
                }
            }
        }

        checklist.checkedIn = true;
        refreshedUser.lastCheckinDate = todayStart.toDate();

        await refreshedUser.save();
        return refreshedUser;
    } catch (error) {
        console.error("❌ Error submitting check-in:", error);
        return null;
    }
}

/**
 * Adds a recent chat message to a user's history.
 * @param {User} user The user document.
 * @param {string} chatText The text of the chat message.
 */
async function addRecentChat(user, chatText) {
    if (!user) {
        console.error("User object is null, cannot add chat.");
        return;
    }
    
    try {
        // Refresh the user to avoid version conflicts
        const refreshedUser = await refreshUser(user);
        if (!refreshedUser) return;
        
        if (!refreshedUser.recentChats) {
            refreshedUser.recentChats = [];
        }
        refreshedUser.recentChats.push({ text: chatText, timestamp: new Date() });
        if (refreshedUser.recentChats.length > 10) {
            refreshedUser.recentChats.shift();
        }
        await refreshedUser.save();
    } catch (error) {
        console.error("❌ Error adding recent chat:", error);
    }
}

/**
 * Adds an important memory to a user's long-term memory.
 * @param {User} user The user document.
 * @param {string} memoryText The text of the important memory.
 */
async function addImportantMemory(user, memoryText) {
    if (!user) {
        console.log("User object is null, cannot add memory.");
        return;
    }

    try {
        // Refresh the user to avoid version conflicts
        const refreshedUser = await refreshUser(user);
        if (!refreshedUser) return;
        
        if (!refreshedUser.importantMemories) {
            refreshedUser.importantMemories = [];
        }
        refreshedUser.importantMemories.push({ text: memoryText, timestamp: new Date() });
        await refreshedUser.save();
    } catch (error) {
        console.error("❌ Error adding important memory:", error);
    }
}

/**
 * RECOVERY: Fix users who were incorrectly moved from free-trial to free
 * Run this once after deploying the fix
 */
async function recoverIncorrectlyExpiredTrials() {
    try {
        const affectedUsers = await User.find({
            subscriptionPlan: 'free',
            subscriptionStatus: 'inactive',
            createdAt: { 
                $gte: moment().tz(TIMEZONE).subtract(7, 'days').toDate() 
            }
        });

        console.log(`Found ${affectedUsers.length} potentially affected users`);

        let recoveredCount = 0;
        for (const user of affectedUsers) {
            // Check if they were created less than 8 days ago
            const userAgeDays = moment().tz(TIMEZONE).diff(moment(user.createdAt).tz(TIMEZONE), 'days');
            
            if (userAgeDays < 8) {
                // This user was incorrectly expired - restore their trial
                user.subscriptionPlan = 'free-trial';
                user.subscriptionStatus = 'trialing';
                user.subscriptionEndDate = moment(user.createdAt).tz(TIMEZONE).add(8, 'days').toDate();
                
                await user.save();
                recoveredCount++;
                console.log(`✅ Restored trial for user ${user.telegramId}, ${8 - userAgeDays} days remaining`);
            }
        }

        console.log(`🎉 Recovery complete: ${recoveredCount} users had trials restored`);
    } catch (error) {
        console.error('❌ Error in trial recovery:', error);
    }
}

module.exports = {
    getOrCreateUser,
    createAndSaveChecklist,
    createManualChecklist, // 🆕 Export manual checklist function
    getChecklistByDate,
    handleDailyCheckinReset,
    toggleTaskCompletion,
    submitCheckin,
    addRecentChat,
    addImportantMemory,
    getChecklistById,
    updateChecklist,
    refreshUser,
    recoverIncorrectlyExpiredTrials
};