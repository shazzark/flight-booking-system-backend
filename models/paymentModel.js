// models/paymentModel.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Payment must belong to a user'],
  },
  booking: {
    type: mongoose.Schema.ObjectId,
    ref: 'Booking',
    required: [true, 'Payment must belong to a booking'],
    unique: true,
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount cannot be negative'],
  },
  currency: {
    type: String,
    default: 'NGN',
    enum: ['NGN', 'USD', 'EUR', 'GBP'],
  },
  provider: {
    type: String,
    default: 'paystack',
    enum: ['paystack'],
  },
  status: {
    type: String,
    enum: ['initiated', 'success', 'failed', 'refunded'],
    default: 'initiated',
  },
  transactionId: {
    type: String,
    unique: true,
  },
  reference: {
    type: String,
    unique: true,
    required: [true, 'Payment reference is required'],
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'bank_transfer', 'mobile_money'],
    default: 'card',
  },
  metadata: {
    type: Object,
    default: {},
  },
  initiatedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: Date,
});

// Update booking status when payment is successful
paymentSchema.post('findOneAndUpdate', async function (doc, next) {
  if (doc.status === 'success' && this._update.status === 'success') {
    const Booking = require('./bookingModel');
    await Booking.findByIdAndUpdate(doc.booking, {
      status: 'confirmed',
      paymentStatus: 'paid',
    });
  }

  if (
    (doc.status === 'failed' || doc.status === 'refunded') &&
    (this._update.status === 'failed' || this._update.status === 'refunded')
  ) {
    const Booking = require('./bookingModel');
    await Booking.findByIdAndUpdate(doc.booking, {
      status: this._update.status === 'failed' ? 'expired' : 'cancelled',
      paymentStatus: this._update.status,
    });
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
