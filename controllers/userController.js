// File: src/controllers/userController.js
// This file contains the logic for handling user messages and interacting with the database.
// This version is cleaned up to correctly handle daily resets and work in tandem with messageHandlers.

const User = require('../models/user');
const moment = require('moment-timezone');

const TIMEZONE = 'Africa/Lagos';

/**
 * Generates a simple unique ID string using the current timestamp and a random number.
 * @returns {string} A unique ID.
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

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
                aiUsageCount: 0,
                onboardingStep: 'start',
                recentChats: [],
                importantMemories: [],
            });
            await user.save();
            console.log(`New user created: ${telegramId}`);
        }
        // Handle cases where existing users in the database don't have these fields yet
        if (!user.recentChats) {
            user.recentChats = [];
        }
        if (!user.importantMemories) {
            user.importantMemories = [];
        }
        if (!user.onboardingStep) {
            user.onboardingStep = 'start';
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
 * Creates a new checklist for the user with unique IDs for the checklist and tasks.
 * @param {string} telegramId The unique ID of the user on Telegram.
 * @param {object} newChecklist The checklist object to be saved.
 * @returns {Promise<Object|null>} The newly created checklist or null if an error occurs.
 */
async function createAndSaveChecklist(telegramId, newChecklist) {
    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            console.error("User not found, cannot save checklist.");
            return null;
        }

        // Add the new checklist to the user's checklists array
        user.checklists.push(newChecklist);
        await user.save();

        console.log(`New checklist created for user ${telegramId} with ID: ${newChecklist.id}`);
        return newChecklist;
    } catch (error) {
        console.error("❌ Error creating and saving checklist:", error);
        return null;
    }
}

/**
 * Retrieves a checklist by its date for a specific user.
 * @param {string} telegramId The user's Telegram ID.
 * @param {string} dateString The date in 'YYYY-MM-DD' format.
 * @returns {Promise<Object|null>} The checklist object or null if not found.
 */
async function getChecklistByDate(telegramId, dateString) {
    try {
        const user = await User.findOne({ telegramId });
        if (!user) {
            return null;
        }
        const targetDate = moment.tz(dateString, TIMEZONE).startOf('day').toDate();
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
        const todayStart = now.startOf('day');

        // If the user has not checked in today
        if (!user.lastCheckinDate || moment(user.lastCheckinDate).tz(TIMEZONE).isBefore(todayStart, 'day')) {
            const yesterdayStart = todayStart.clone().subtract(1, 'day');
            // If they did not check in yesterday, reset streak
            if (!user.lastCheckinDate || moment(user.lastCheckinDate).tz(TIMEZONE).isBefore(yesterdayStart, 'day')) {
                if (user.streak > 0) {
                    console.log(`❌ User ${user.telegramId} missed check-in. Streak reset.`);
                    user.streak = 0;
                }
            }
        }
        await user.save();
    } catch (error) {
        console.error("❌ Error handling daily check-in reset:", error);
    }
}

/**
 * Toggles the completion status of a task in a user's checklist.
 * @param {User} user The user document.
 * @param {string} checklistId The ID of the checklist.
 * @param {string} taskId The ID of the task to toggle.
 * @returns {Object|null} The updated checklist or null if not found.
 */
async function toggleTaskCompletion(user, checklistId, taskId) {
    if (!user) {
        return null;
    }

    try {
        const checklist = user.checklists.find(c => c.id === checklistId);
        if (!checklist) {
            console.error(`Checklist not found with ID: ${checklistId}`);
            return null;
        }

        const task = checklist.tasks.find(t => t.id === taskId);
        if (!task) {
            console.error(`Task not found with ID: ${taskId} in checklist ${checklistId}`);
            return null;
        }

        task.completed = !task.completed;
        await user.save();
        return checklist;
    } catch (error) {
        console.error("❌ Error toggling task completion:", error);
        return null;
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
        const user = await User.findOne({ telegramId });
        if (!user) {
            console.error("User not found, cannot update checklist.");
            return null;
        }
        const checklistIndex = user.checklists.findIndex(c => c.id === updatedChecklist.id);
        if (checklistIndex !== -1) {
            user.checklists[checklistIndex] = updatedChecklist;
            await user.save();
            return user.checklists[checklistIndex];
        } else {
            console.error(`Checklist with ID ${updatedChecklist.id} not found for user ${telegramId}.`);
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
        const user = await User.findOne({ telegramId });
        if (!user) {
            return null;
        }
        return user.checklists.find(c => c.id === checklistId);
    } catch (error) {
        console.error("❌ Error fetching checklist by ID:", error);
        return null;
    }
}

/**
 * Updates the user's streak and last checkin date, then returns a summary message.
 * @param {User} user The user document.
 * @param {string} checklistId The ID of the checklist being submitted.
 * @returns {string} A summary message.
 */
async function submitCheckin(user, checklistId) {
    if (!user) {
        return "Error: User not found.";
    }

    try {
        const checklist = user.checklists.find(c => c.id === checklistId);
        if (!checklist) {
            return "Error: Checklist not found.";
        }
        
        // Use moment to check if it's the same day
        const todayStart = moment().tz(TIMEZONE).startOf('day');
        const lastCheckinIsToday = user.lastCheckinDate && moment(user.lastCheckinDate).tz(TIMEZONE).isSame(todayStart, 'day');

        if (checklist.checkedIn || lastCheckinIsToday) {
            return "You've already submitted your check-in for today!";
        }

        const totalTasks = checklist.tasks.length;
        const completedTasks = checklist.tasks.filter(t => t.completed).length;

        user.lastCheckinDate = new Date();
        user.streak += 1;
        checklist.checkedIn = true;
        await user.save();

        const checkinSummary = `*✅ Daily Check-in Submitted!*

Weekly Goal: ${checklist.weeklyGoal || "No goal set yet."}
Today's Progress: ${completedTasks}/${totalTasks} tasks completed.
Your current streak: ${user.streak} days.
`;
        return checkinSummary;
    } catch (error) {
        console.error("❌ Error submitting check-in:", error);
        return "An error occurred while submitting your check-in.";
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
        // Ensure recentChats is an array before pushing
        if (!user.recentChats) {
            user.recentChats = [];
        }
        user.recentChats.push({ text: chatText, timestamp: new Date() });
        // Keep only the last 10 messages to avoid the array growing too large.
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
        console.error("User object is null, cannot add memory.");
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
    createChecklist,
    createAndSaveChecklist, // <-- Added this line
    getChecklistByDate,
    handleDailyCheckinReset,
    toggleTaskCompletion,
    submitCheckin,
    addRecentChat,
    addImportantMemory,
    getChecklistById, // <-- Added this line
    updateChecklist // <-- Added this line
};
