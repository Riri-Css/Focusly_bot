const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/userData.json');
// This will resolve to: Focusly.bot/data/userData.json

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

module.exports = { loadUserData, saveUserData };
// This module provides functions to load and save user data to a JSON file.
// It checks if the data file exists, reads it if available, and returns the parsed data.