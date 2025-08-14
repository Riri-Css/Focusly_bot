// File: src/routes/paystackWebhook.js - CORRECTED VERSION

const express = require('express');
const crypto = require('crypto');
const User = require('../models/user');
const { sendTelegramMessage } = require('../utils/telegram');
const { bot } = require('../server'); // ✅ CORRECTED IMPORT

const router = express.Router();

// Paystack webhook with raw body for signature verification
router.post(
  '/paystack/webhook',
  express.raw({ type: 'application/json' }), // important for signature
  async (req, res) => {
    try {
      // 1️⃣ Verify Paystack signature
      const expectedSignature = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
        .update(req.body)
        .digest('hex');

      const signature = req.headers['x-paystack-signature'];

      if (signature !== expectedSignature) {
        console.warn('❌ Invalid Paystack webhook signature');
        return res.sendStatus(401);
      }

      // 2️⃣ Parse event data
      const event = JSON.parse(req.body.toString());
      console.log('🔔 Paystack webhook received:', event.event);

      if (event.event === 'charge.success') {
        const data = event.data;

        // Extract metadata
        const telegramId = data.metadata?.custom_fields?.[0]?.telegramId; // ✅ CORRECTED: Use custom_fields
        const plan = data.metadata?.custom_fields?.[0]?.plan; // ✅ CORRECTED: Use custom_fields

        if (!telegramId || !plan) {
          console.warn('⚠️ Missing telegramId or plan in webhook metadata');
          return res.sendStatus(400);
        }

        // Find user
        const user = await User.findOne({ telegramId });
        if (!user) {
          console.warn('⚠️ User not found for telegramId:', telegramId);
          return res.sendStatus(404);
        }
        
        // Update subscription
        user.subscriptionStatus = 'active';
        user.subscriptionPlan = plan; // ✅ Set the plan
        user.subscriptionStartDate = new Date(); // ✅ Set the start date
        user.subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        await user.save();

        // Notify user in Telegram
        await sendTelegramMessage(
          bot,
          telegramId,
          `🎉 Your **${plan}** subscription is now active! Thank you for your support.`
        );

        console.log(`✅ Subscription activated for ${telegramId} - Plan: ${plan}`);
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error('❌ Webhook error:', err);
      return res.sendStatus(500);
    }
  }
);

module.exports = router;