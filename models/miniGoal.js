// models/MiniGoal.js
const mongoose = require("mongoose");

const miniGoalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    telegramId: { type: String, required: true }, 
    text: { type: String, required: true },   // e.g. "drink water"
    time: { type: Date, required: true },     // exact reminder time
    reminded: { type: Boolean, default: false }, // prevent duplicate reminders
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("MiniGoal", miniGoalSchema);
