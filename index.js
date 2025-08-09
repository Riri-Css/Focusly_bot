// File: index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');

// Import handlers for different types of updates
const { handleMessage } = require('./handlers/messageHandlers');
const { handleCallbackQuery } = require('./handlers/callbackHandlers');
const paystackWebhook = require('./routes/paystackWebhook');
const moment = require('moment-timezone');

const app = express();
const bot = new TelegramBot(process.env.BOT_TOKEN);

// Set Webhook
bot.setWebHook(`${process.env.RENDER_EXTERNAL_URL}/webhook`);

app.use(express.json());

// Main webhook endpoint that routes updates
app.post(`/webhook`, async (req, res) => {
    try {
        const update = req.body;
        
        if (update.message) {
            // Route to message handler
            console.log("📩 Incoming message:", update.message.text);
            await handleMessage(bot, update.message);
        } else if (update.callback_query) {
            // Route to callback query handler
            console.log("🔘 Incoming callback query:", update.callback_query.data);
            await handleCallbackQuery(bot, update.callback_query);
        }
        
        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Error in webhook handler:", err);
        res.sendStatus(500);
    }
});

app.use('/paystack/webhook', paystackWebhook);

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useUnifiedTopology: true,
}).then(() => {
    console.log('✅ MongoDB connected');
}).catch((err) => {
    console.error('❌ MongoDB connection error:', err);
});

// Health check
app.get('/', (req, res) => {
    res.send('🚀 Focusly bot server is running');
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
});
