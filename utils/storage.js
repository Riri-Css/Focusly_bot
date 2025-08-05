// File: src/controllers/userController.js (or similar)
const User = require('../models/user');

// Refactored function to save the goal directly to MongoDB
async function addGoalMemory(user, goalText) {
  if (user) {
    user.goalMemory = {
      text: goalText,
      date: new Date()
    };
    await user.save();
    console.log(`✅ Goal for user ${user.telegramId} saved to database.`);
  } else {
    console.error(`❌ User not found to save goal.`);
  }
}

// You will also need to add this function to your userController file
// or wherever your other database-related functions live.
// The `handleMessage` file is now calling this new function.