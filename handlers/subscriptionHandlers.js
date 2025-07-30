const axios = require('axios');
const User = require('../models/user');
const { isTrialExpired, setSubscriptionStatus, getPlanDetails } = require('../utils/subscriptionUtils');

async function handleSubscriptionStatus(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  const expired = isTrialExpired(user);
  if (expired && user.subscription.status === 'none') {
    user.access.ai = false;
    user.access.checklist = true;
    user.subscription.status = 'trial_expired';
    await user.save();
  }
}

async function verifyAndActivateSubscription(reference) {
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = response.data;
    if (!data.status || data.data.status !== 'success') return null;

    const email = data.data.customer.email;
    const planCode = data.data.plan;
    const user = await User.findOne({ email });

    if (!user) return null;

    const planDetails = getPlanDetails(planCode);
    if (!planDetails) return null;

    user.subscription = {
      status: 'active',
      plan: planDetails.name,
      subscribedAt: new Date(),
      paystackReference: reference,
    };

    user.access = {
      ai: true,
      checklist: true,
    };

    user.ai = {
      dailyUses: 0,
      weeklyUses: 0,
      lastUsedAt: null,
    };

    await user.save();
    return user;
  } catch (error) {
    console.error('Subscription verification failed:', error.message);
    return null;
  }
}

module.exports = {
  handleSubscriptionStatus,
  verifyAndActivateSubscription,
};
