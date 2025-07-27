// subscriptionHandlers.js

const { generatePaystackLink } = require("./utils/paymentUtils");

const handleSubscribeCommand = async (bot, msg) => {
  const chatId = msg.chat.id;

  const message = `
🔥 *Focusly Premium Plans*

Choose a plan to unlock smart AI help and milestone tracking.

🟡 *Basic – ₦1,000/month*
Includes *10 AI smart uses per week*

🟢 *Premium – ₦1,500/month*
Includes *Unlimited AI uses*

_Select a plan below to continue_:
  `;

  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔸 Basic (₦1,000)", callback_data: "subscribe_basic" },
        ],
        [
          { text: "💎 Premium (₦1,500)", callback_data: "subscribe_premium" },
        ]
      ]
    }
  };

  bot.sendMessage(chatId, message, options);
};

const handleSubscriptionCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data === "subscribe_basic" || data === "subscribe_premium") {
    const plan = data === "subscribe_basic" ? "Basic" : "Premium";
    const amount = plan === "Basic" ? 100000 : 150000; // Paystack amount in kobo

    const paymentLink = generatePaystackLink(userId, plan);

    await bot.sendMessage(chatId, `You're choosing the *${plan}* plan.

Click below to proceed with secure payment via Paystack.`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: `💳 Pay ₦${amount / 100} Now`, url: paymentLink }
          ]
        ]
      }
    });
  }
};

module.exports = {
  handleSubscribeCommand,
  handleSubscriptionCallback
};
