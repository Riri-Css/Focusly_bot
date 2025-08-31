// utils/paymentUtils.js

const generatePaystackLink = (telegramId, plan) => {
  const metadata = {
    telegramId,
    plan
  };

  let base = "";

  if (plan === "Basic") {
    base = "https://paystack.com/pay/focusly-basic"; 
  } else if (plan === "Premium") {
    base = "https://paystack.com/pay/focusly-premium"; 
  }

  return `${base}?metadata=${encodeURIComponent(JSON.stringify(metadata))}`;
};

module.exports = { generatePaystackLink };
