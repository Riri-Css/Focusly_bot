// paystackWebhook.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User'); // adjust path

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

router.post('/paystack/webhook', express.json({ verify: (req, res, buf) => {
  req.rawBody = buf;
} }), async (req, res) => {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const { customer, plan, paidAt } = event.data;
    const telegramId = customer.metadata?.telegramId;

    if (!telegramId) return res.status(400).send('Missing telegram ID');

    // Calculate expiry (30 days access for now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    await User.updateOne(
      { telegramId },
      {
        subscription: {
          planCode: plan.plan_code,
          planName: plan.name,
          subscribedAt: new Date(paidAt),
          expiresAt: expiryDate,
        },
        isSubscribed: true
      },
      { upsert: true }
    );
  }

  res.sendStatus(200);
});

module.exports = router;
