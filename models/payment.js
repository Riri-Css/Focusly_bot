const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  status: String,
  planCode: String,
  reference: String,
  paidAt: Date
});

module.exports = mongoose.model('Payment', paymentSchema);
