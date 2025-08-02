require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');
const handleMessage = require('./handlers/messageHandlers'); // ✅ Make sure this points to your actual handleMessage location

async function test() {
  try {
    console.log('🚀 Starting test...');

    // Create or find test user
    const chatId = '123456789';
    let user = await User.findOne({ chatId });                                                                                                                                                                                                                                                                                                                                                                          

    if (!user) {
  user = new User({
    chatId,
    telegramId: '123456789', // ✅ Add this line
    username: 'test_user',
    isOnboarded: true,
    onboardingStep: null,
    focus: 'Studying JavaScript',
    trialStartDate: new Date(),
    subscriptionStatus: 'trial',
    aiUsage: {
      dailyUses: 0,
      weeklyUses: 0,
      lastUsed: null,
    },
  });
  await user.save();
  console.log('🆕 Created new test user');
}
    else {
      console.log('👤 Found existing test user');
    }

    // Simulate incoming Telegram message
    const msg = {
      chat: { id: chatId, username: user.username },
      text: 'hi', // Try changing this to 'check in', 'my tasks', or 'generate checklist'
    };

    console.log(`💬 Simulating message from user: "${msg.text}"`);

    // Call handleMessage like Telegram would
    await handleMessage(msg);
    console.log('✅ handleMessage executed without error');
  } catch (err) {
    console.error('❌ Test failed:', err);
  }
}

// Connect to MongoDB and start the test
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    test(); // 🚀 Don't forget to call the test here
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
