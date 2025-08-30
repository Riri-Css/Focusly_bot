// models/MiniGoal.js
const mongoose = require("mongoose");


const miniGoalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true }, // e.g. "drink water"
    time: { type: Date, required: true },   // exact reminder time
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("MiniGoal", miniGoalSchema);
