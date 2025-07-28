const express = require('express');
const router = express.Router();
const User = require('../models/user');

router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;

    console.log('🔔 Paystack webhook received:', event.event);

    // Only listen to successful subscription charge events
    if (event.event === 'charge.success') {
      const data = event.data;
      const telegramId = data.metadata?.telegram_id;
      const plan = data.plan?.plan_code;

      if (!telegramId || !plan) {
        console.warn('⚠️ Missing telegramId or plan in webhook data');
        return res.sendStatus(400);
      }

      const user = await User.findOne({ telegramId });
      if (!user) {
        console.warn('⚠️ User not found for telegramId:', telegramId);
        return res.sendStatus(404);
      }

      // Prevent duplicate updates if already subscribed
      const now = new Date();
      if (user.subscriptionEnds && user.subscriptionEnds > now) {
        console.log('ℹ️ User already has an active subscription.');
        return res.sendStatus(200);
      }

      // Grant subscription
      user.isSubscribed = true;
      user.subscriptionPlan = plan;
      user.subscriptionEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 days
      await user.save();

      console.log(`✅ Subscription activated for ${telegramId} - Plan: ${plan}`);
      return res.sendStatus(200);
    }

    // Handle other event types (optional)
    return res.sendStatus(200);
  } catch (err) {
    console.error('❌ Webhook error:', err);
    return res.sendStatus(500);
  }
});

module.exports = router;
