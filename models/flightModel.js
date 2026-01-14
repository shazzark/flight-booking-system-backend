// models/flightModel.js
const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  airline: {
    type: String,
    required: [true, 'Airline name is required'],
    trim: true,
  },
  flightNumber: {
    type: String,
    required: [true, 'Flight number is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  origin: {
    type: String,
    required: [true, 'Origin airport code is required'],
    uppercase: true,
    minlength: 3,
    maxlength: 3,
  },
  destination: {
    type: String,
    required: [true, 'Destination airport code is required'],
    uppercase: true,
    minlength: 3,
    maxlength: 3,
  },
  departureTime: {
    type: Date,
    required: [true, 'Departure time is required'],
  },
  arrivalTime: {
    type: Date,
    required: [true, 'Arrival time is required'],
    validate: {
      validator: function (value) {
        return value > this.departureTime;
      },
      message: 'Arrival time must be after departure time',
    },
  },
  duration: {
    type: Number, // in minutes
    default: function () {
      if (this.departureTime && this.arrivalTime) {
        return Math.round(
          (this.arrivalTime - this.departureTime) / (1000 * 60),
        );
      }
      return 0;
    },
  },
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative'],
  },
  seatsAvailable: {
    type: Number,
    required: [true, 'Seats available is required'],
    min: [0, 'Seats cannot be negative'],
    default: 100,
  },
  status: {
    type: String,
    enum: ['scheduled', 'cancelled', 'delayed', 'completed'],
    default: 'scheduled',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Calculate duration before saving
flightSchema.pre('save', function () {
  if (this.departureTime && this.arrivalTime) {
    this.duration = Math.round(
      (this.arrivalTime - this.departureTime) / (1000 * 60),
    );
  }
  // next();
});

const Flight = mongoose.model('Flight', flightSchema);
module.exports = Flight;
