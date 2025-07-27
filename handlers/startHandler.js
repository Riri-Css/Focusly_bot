// handlers/startHandler.js

const handleMessage = require('./messageHandlers');

module.exports = (bot) => async (msg) => {
  const isStart = true;
  await handleMessage(bot, msg, isStart);
};
