// models/bookingModel.js
const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Passenger name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Passenger email is required'],
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Passenger phone is required'],
  },
  seatNumber: {
    type: String,
    required: [true, 'Seat number is required'],
    uppercase: true,
  },
});

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Booking must belong to a user'],
  },
  flight: {
    type: mongoose.Schema.ObjectId,
    ref: 'Flight',
    required: [true, 'Booking must belong to a flight'],
  },
  passengers: [passengerSchema],
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Amount cannot be negative'],
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'expired'],
    default: 'pending',
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid', 'refunded', 'failed'],
    default: 'unpaid',
  },
  seatNumber: {
    type: String,
    required: [true, 'Seat number is required'],
    uppercase: true,
  },
  bookingReference: {
    type: String,
    unique: true,
    uppercase: true,
  },
  expiresAt: {
    type: Date,
    default: function () {
      // Booking expires in 30 minutes if not paid
      return new Date(Date.now() + 30 * 60 * 1000);
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate booking reference before saving
bookingSchema.pre('save', async function () {
  if (!this.bookingReference) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let reference = '';
    for (let i = 0; i < 6; i++) {
      reference += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.bookingReference = reference;
  }
  // next();
});

// Update flight seats when booking is confirmed
bookingSchema.post('save', async function (doc) {
  if (doc.status === 'confirmed' && doc.paymentStatus === 'paid') {
    const Flight = require('./flightModel');
    await Flight.findByIdAndUpdate(doc.flight, {
      $inc: { seatsAvailable: -doc.passengers.length },
    });
  }
  // next();
});

// Restore seats when booking is cancelled
bookingSchema.post('findOneAndUpdate', async function (doc) {
  if (doc.status === 'cancelled' && this._update.status === 'cancelled') {
    const Flight = require('./flightModel');
    await Flight.findByIdAndUpdate(doc.flight, {
      $inc: { seatsAvailable: doc.passengers.length },
    });
  }
  // next();
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
