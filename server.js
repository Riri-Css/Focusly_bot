const express = require('express');
const app = express();
const paystackWebhook = require('./routes/paystackWebhook');

app.use(express.json());
app.use('/paystack/webhook', paystackWebhook);

// Root route for testing
app.get('/', (req, res) => {
  res.send('Focusly bot server is live');
});

// Render uses this port from env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
