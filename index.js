// 🆕 This is the updated and integrated callback query handler with added logs
bot.on('callback_query', async (callbackQuery) => {
    const { from, data } = callbackQuery;
    const userId = from.id;
    const chatId = callbackQuery.message.chat.id;

    console.log('✅ Received callback query.');

    try {
        const parsedData = JSON.parse(data);
        console.log('✅ Successfully parsed callback data.');
        const { action } = parsedData;

        // Route to the appropriate handler based on the button action
        if (action === 'toggle_task') {
            console.log('➡️ Routing to handleTaskToggle...');
            await handleTaskToggle(bot, callbackQuery);
        } else if (action === 'submit_checkin') {
            console.log('➡️ Routing to handleSubmitCheckin...');
            await handleSubmitCheckin(bot, callbackQuery);
        } else if (action === 'subscribe') {
            const plan = parsedData.plan;
            const amount = plan === 'premium' ? 1000 : 500;
            const user = await getUserByTelegramId(userId);

            if (!user) {
                return bot.answerCallbackQuery(callbackQuery.id, { text: "User not found. Please start over." });
            }

            const paymentLink = await generatePaystackLink(user, amount, plan);

            if (paymentLink) {
                const message = `Please click the button below to subscribe to the *${plan} plan* for $${amount/100}.\n\n*Note: If you've already paid, your subscription will be activated automatically. If it isn't, please contact support.*`;
                await bot.sendMessage(chatId, message, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Click to Pay', url: paymentLink }],
                        ],
                    },
                    parse_mode: 'Markdown',
                });
            } else {
                await bot.sendMessage(chatId, "❌ I couldn't generate a payment link at the moment. Please try again later.");
            }
            await bot.answerCallbackQuery(callbackQuery.id);
        } else {
            await bot.answerCallbackQuery(callbackQuery.id, { text: "Unknown action." });
        }
    } catch (error) {
        console.error("❌ Error handling callback query:", error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong." });
    }
});