const express = require('express');
const router = express.Router();
const { verifyAndActivateSubscription } = require('./utils/subscriptionHandlers');

// Paystack webhook endpoint
router.post('/paystackwebhook', express.json({ verify: verifyPaystackSignature }), async (req, res) => {
  const event = req.body;

  if (event.event === 'charge.success') {
    const reference = event.data.reference;
    await verifyAndActivateSubscription(reference);
  }

  res.sendStatus(200);
});

// Middleware to verify Paystack signature
function verifyPaystackSignature(req, res, buf) {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(buf)
    .digest('hex');

  const signature = req.headers['x-paystack-signature'];

  if (signature !== expectedSignature) {
    throw new Error('Invalid Paystack webhook signature');
  }
}

module.exports = router;
