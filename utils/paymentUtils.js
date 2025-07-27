// utils/paymentUtils.js

const generatePaystackLink = (telegramId, plan) => {
  const metadata = {
    telegramId,
    plan
  };

  let base = "";

  if (plan === "Basic") {
    base = "https://paystack.com/pay/focusly-basic"; // 🔁 Replace with your real Basic plan link
  } else if (plan === "Premium") {
    base = "https://paystack.com/pay/focusly-premium"; // 🔁 Replace with your real Premium plan link
  }

  return `${base}?metadata=${encodeURIComponent(JSON.stringify(metadata))}`;
};

module.exports = { generatePaystackLink };
