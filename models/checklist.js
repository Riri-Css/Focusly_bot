const mongoose = require('mongoose');

const checklistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // format: YYYY-MM-DD
  tasks: [
    {
      text: String,
      completed: { type: Boolean, default: false },
      carriedOver: { type: Boolean, default: false },
    }
  ],
});

checklistSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Checklist', checklistSchema);
