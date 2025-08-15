// File: src/controllers/userController.js - FINAL UPDATED VERSION

const User = require('../models/user');
const moment = require('moment-timezone');
const mongoose = require('mongoose');

const TIMEZONE = 'Africa/Lagos';

/**
 * Retrieves a user from the database or creates a new one if they don't exist.
 * @param {string} telegramId The unique ID of the user on Telegram.
 * @returns {Promise<User>} The user document.
 */
async function getOrCreateUser(telegramId) {
    try {
        let user = await User.findOne({ telegramId: telegramId });
        if (!user) {
            user = new User({
                telegramId: telegramId,
                streak: 0,
                lastCheckin: null,
                goalMemory: { text: null },
                checklists: [],
                lastCheckinDate: null,
                consecutiveChecks: 0,
                subscriptionStatus: 'inactive',
                subscriptionPlan: 'free',
                aiUsage: [], 
                onboardingStep: 'awaiting_goal', // <-- CORRECTED: New users are now in the 'awaiting_goal' state.
                recentChats: [],
                importantMemories: [],
            });
            await user.save();
            console.log(`New user created: ${telegramId}`);
        } else {
            // --- TEMPORARY PATCH START ---
            // This checks for and corrects the invalid 'start' value for existing users.
            if (user.onboardingStep === 'start') {
                user.onboardingStep = 'awaiting_goal';
                await user.save();
                console.log(`✅ Corrected onboardingStep for user ${telegramId}.`);
            }
            // --- TEMPORARY PATCH END ---

            if (!user.aiUsage || !Array.isArray(user.aiUsage)) {
                user.aiUsage = [];
                await user.save();
            }
        }
        if (!user.recentChats) {
            user.recentChats = [];
        }
        if (!user.importantMemories) {
            user.importantMemories = [];
        }
        // Corrected: If onboardingStep is missing, set to a valid value
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

        const today = moment().tz(TIMEZONE).startOf('day').toDate();
        if (user.checklists.find(c => moment(c.date).tz(TIMEZONE).isSame(today, 'day'))) {
            console.warn(`Attempted to create duplicate checklist for user ${telegramId} on ${today}`);
            return user.checklists.find(c => moment(c.date).tz(TIMEZONE).isSame(today, 'day'));
        }

        const yesterday = moment().tz(TIMEZONE).subtract(1, 'day').startOf('day').toDate();
        const yesterdayChecklist = user.checklists.find(c => moment(c.date).tz(TIMEZONE).isSame(yesterday, 'day'));
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
            weeklyGoal: aiResponse.weekly_goal || user.goalMemory.text,
            tasks: newTasks,
            checkedIn: false,
            date: today
        };
        
        user.checklists.unshift(newChecklist);
        await user.save();
        return newChecklist;

    } catch (error) {
        console.error('Error creating and saving checklist:', error);
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
        const now = moment().tz(TIMEZONE);
        const todayStart = now.clone().startOf('day');

        if (user.lastCheckinDate) {
            const lastCheckinMoment = moment(user.lastCheckinDate).tz(TIMEZONE);
            const isYesterday = lastCheckinMoment.isSame(todayStart.clone().subtract(1, 'day'), 'day');
            const isToday = lastCheckinMoment.isSame(todayStart, 'day');
            
            if (!isYesterday && !isToday) {
                console.log(`❌ User ${user.telegramId} missed check-in. Streak reset.`);
                user.streak = 0;
            }
        }
        await user.save();
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
        const checklistIndex = user.checklists.findIndex(c => c._id.toString() === updatedChecklist._id.toString());
        if (checklistIndex !== -1) {
            user.checklists[checklistIndex] = updatedChecklist;
            await user.save();
            return user.checklists[checklistIndex];
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
        const checklist = user.checklists.find(c => c._id.toString() === checklistId);
        if (!checklist) {
            console.error(`Checklist not found with ID: ${checklistId}`);
            return null;
        }
        if (checklist.tasks[taskIndex]) {
            checklist.tasks[taskIndex].completed = !checklist.tasks[taskIndex].completed;
            await user.save();
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
        const checklist = user.checklists.find(c => c._id.toString() === checklistId);
        if (!checklist) {
            return null;
        }
        
        if (checklist.checkedIn) {
            return user; // Already checked in, do nothing
        }

        const todayStart = moment().tz(TIMEZONE).startOf('day');
        const yesterdayStart = todayStart.clone().subtract(1, 'day');
        
        const lastCheckinDate = user.lastCheckinDate ? moment(user.lastCheckinDate).tz(TIMEZONE).startOf('day') : null;
        
        // Check if the last check-in was yesterday
        if (lastCheckinDate && lastCheckinDate.isSame(yesterdayStart, 'day')) {
            user.streak = (user.streak || 0) + 1;
        } else if (lastCheckinDate && lastCheckinDate.isSame(todayStart, 'day')) {
            // User already checked in today, do nothing. This is a double check.
        } else {
            // Missed a day or this is the first check-in
            user.streak = 1;
        }
        
        checklist.checkedIn = true;
        user.lastCheckinDate = todayStart.toDate();
        
        await user.save();
        return user;
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
        if (!user.recentChats) {
            user.recentChats = [];
        }
        user.recentChats.push({ text: chatText, timestamp: new Date() });
        if (user.recentChats.length > 10) {
            user.recentChats.shift();
        }
        await user.save();
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
        if (!user.importantMemories) {
            user.importantMemories = [];
        }
        user.importantMemories.push({ text: memoryText, timestamp: new Date() });
        await user.save();
    } catch (error) {
        console.error("❌ Error adding important memory:", error);
    }
}

module.exports = {
    getOrCreateUser,
    createAndSaveChecklist,
    getChecklistByDate,
    handleDailyCheckinReset,
    toggleTaskCompletion,
    submitCheckin,
    addRecentChat,
    addImportantMemory,
    getChecklistById,
    updateChecklist
};