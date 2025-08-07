const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { sendTelegramMessage } = require('../utils/telegram');
const bot = require('../botInstance'); // 🆕 Ensure you have a way to import the bot instance

router.post('/', async (req, res) => {
  try {
    const event = req.body;

    console.log('🔔 Paystack webhook received:', event.event);

    // Only listen to successful charge events
    if (event.event === 'charge.success') {
      const data = event.data;
      
      // 🆕 CRITICAL FIX: Get data from metadata
      const telegramId = data.metadata?.user_id;
      const plan = data.metadata?.plan;

      if (!telegramId || !plan) {
        console.warn('⚠️ Missing telegramId or plan in webhook metadata');
        return res.sendStatus(400);
      }

      const user = await User.findOne({ telegramId });
      if (!user) {
        console.warn('⚠️ User not found for telegramId:', telegramId);
        return res.sendStatus(404);
      }

      // Grant subscription
      user.isSubscribed = true;
      user.subscriptionPlan = plan;
      // 🆕 Use a more robust date calculation
      user.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
      user.subscriptionStatus = 'active';

      await user.save();

      // 🆕 Send a confirmation message to the user
      await sendTelegramMessage(bot, telegramId, `🎉 Your **${plan}** subscription is now active! Thank you for your support.`);

      console.log(`✅ Subscription activated for ${telegramId} - Plan: ${plan}`);
      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook error:', err);
    return res.sendStatus(500);
  }
});

module.exports = router;