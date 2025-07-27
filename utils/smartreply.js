module.exports = function getSmartReply(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('study') || lowerText.includes('exam') || lowerText.includes('read')) {
    return 'Let’s goooo! I believe in your brain 📚 Remember, no distractions, deal?';
  } else if (lowerText.includes('tired') || lowerText.includes('weak') || lowerText.includes('burnt')) {
    return 'Take a breath. A short break is fine, but don’t give up!';
  }
  return null;
};
// This function provides smart replies based on the user's input text.
// It checks for keywords related to studying or feeling tired and returns appropriate motivational messages.