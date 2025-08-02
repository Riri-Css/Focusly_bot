const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/userData.json');

function loadUserData() {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
  }
  return {};
}

function saveUserData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getUserMemory(userId) {
  const allData = loadUserData();
  return allData[userId] || {
    goalMemory: null,
    importantMemory: [],
    recentChatMemory: [],
  };
}

function saveUserMemory(userId, memoryUpdate) {
  const allData = loadUserData();
  const existing = getUserMemory(userId);

  const updated = {
    ...existing,
    ...memoryUpdate,
  };

  allData[userId] = updated;
  saveUserData(allData);
}

function addGoalMemory(userId, goal) {
  saveUserMemory(userId, {
    goalMemory: {
      text: goal,
      timestamp: Date.now()
    }
  });
}

function addImportantMemory(userId, info) {
  const user = getUserMemory(userId);
  user.importantMemory.push({
    text: info,
    timestamp: Date.now()
  });
  saveUserMemory(userId, user);
}

function addRecentChat(userId, message) {
  const user = getUserMemory(userId);
  const chats = user.recentChatMemory || [];
  chats.push({
    text: message,
    timestamp: Date.now()
  });

  // Keep only last 20 messages or those from past 7 days
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const filtered = chats.filter(msg => now - msg.timestamp <= sevenDays);

  saveUserMemory(userId, {
    recentChatMemory: filtered.slice(-20)
  });
}

function cleanupExpiredMemories() {
  const allData = loadUserData();
  const now = Date.now();

  const oneYear = 365 * 24 * 60 * 60 * 1000;
  const sixMonths = 182 * 24 * 60 * 60 * 1000;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  for (const userId in allData) {
    const user = allData[userId];

    // Clean goal if older than 1 year
    if (user.goalMemory && now - user.goalMemory.timestamp > oneYear) {
      user.goalMemory = null;
    }

    // Clean importantMemory entries older than 6 months
    if (Array.isArray(user.importantMemory)) {
      user.importantMemory = user.importantMemory.filter(
        mem => now - mem.timestamp <= sixMonths
      );
    }

    // Clean recentChatMemory older than 7 days
    if (Array.isArray(user.recentChatMemory)) {
      user.recentChatMemory = user.recentChatMemory.filter(
        msg => now - msg.timestamp <= sevenDays
      );
    }

    allData[userId] = user;
  }

  saveUserData(allData);
}

// Optionally schedule cleanup (e.g. run once daily via cron)
module.exports = {
  loadUserData,
  saveUserData,
  getUserMemory,
  saveUserMemory,
  addGoalMemory,
  addImportantMemory,
  addRecentChat,
  cleanupExpiredMemories,
};
