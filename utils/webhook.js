const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/user');

router.post('/', async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).send('Unauthorized');
  }

  const event = req.body;

  if (event.event === 'charge.success') {
    const email = event.data.customer.email;
    const planCode = event.data.plan.plan_code;
    const subscriptionDate = new Date();

    try {
      await User.findOneAndUpdate(
        { telegramId: email }, // Or however you're storing it
        {
          isSubscribed: true,
          'subscription.planCode': planCode,
          'subscription.planName': event.data.plan.name,
          'subscription.subscribedAt': subscriptionDate,
          'subscription.expiresAt': new Date(subscriptionDate.getTime() + 30 * 24 * 60 * 60 * 1000),
        }
      );
    } catch (error) {
      console.error('Webhook DB update error:', error.message);
    }
  }

  res.sendStatus(200);
});

module.exports = router;
