// controllers/bookingController.js
const Booking = require('../models/bookingModel');
const Flight = require('../models/flightModel');
const catchAsync = require('../utilis/catchAsync');
const AppError = require('../utilis/appError');

// GET all bookings (Admin only)
exports.getAllBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find()
    .populate('user', 'name email')
    .populate('flight', 'airline flightNumber origin destination departureTime')
    .sort('-createdAt');

  // res.status(200).json({
  //   status: 'success',
  //   results: bookings.length,
  //   data: {
  //     bookings,
  //   },
  // });
  res.status(200).json(bookings);
});

// GET user's bookings
exports.getMyBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id })
    .populate(
      'flight',
      'airline flightNumber origin destination departureTime arrivalTime',
    )
    .sort('-createdAt');

  // res.status(200).json({
  //   status: 'success',
  //   results: bookings.length,
  //   data: bookings,
  // });
  res.status(200).json(bookings);
});

// GET single booking
exports.getBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
    .populate('user', 'name email')
    .populate('flight');

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Check if user owns the booking or is admin
  if (
    booking.user._id.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError('You are not authorized to view this booking', 403),
    );
  }

  // res.status(200).json({
  //   status: 'success',
  //   data: {
  //     booking,
  //   },
  // });
  res.status(200).json(booking);
});

// POST create booking
exports.createBooking = catchAsync(async (req, res, next) => {
  const { flightId, passengers, seatNumber } = req.body;

  // 1) Get flight and check availability
  const flight = await Flight.findById(flightId);
  if (!flight) {
    return next(new AppError('Flight not found', 404));
  }

  if (flight.seatsAvailable < passengers.length) {
    return next(new AppError('Not enough seats available', 400));
  }

  if (flight.status !== 'scheduled') {
    return next(new AppError('Flight is not available for booking', 400));
  }

  // 2) Calculate total amount
  const totalAmount = flight.basePrice * passengers.length;

  // 3) Create booking
  const booking = await Booking.create({
    user: req.user.id,
    flight: flightId,
    passengers,
    seatNumber,
    totalAmount,
  });

  // 4) Populate flight info in response
  const populatedBooking = await Booking.findById(booking._id).populate(
    'flight',
  );

  res.status(201).json({
    status: 'success',
    data: {
      booking: populatedBooking,
    },
  });
});

// PATCH update booking status (cancel booking)
exports.cancelBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('No booking found with that ID', 404));
  }

  // Check if user owns the booking or is admin
  if (booking.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new AppError('You are not authorized to cancel this booking', 403),
    );
  }

  // Check if booking can be cancelled
  if (booking.status === 'cancelled') {
    return next(new AppError('Booking is already cancelled', 400));
  }

  if (booking.status === 'expired') {
    return next(new AppError('Cannot cancel an expired booking', 400));
  }

  // Update booking status
  booking.status = 'cancelled';
  booking.paymentStatus = 'refunded';
  await booking.save();

  res.status(200).json({
    status: 'success',
    data: {
      booking,
    },
  });
});

// GET booking statistics (Admin only)
exports.getBookingStats = catchAsync(async (req, res, next) => {
  const stats = await Booking.aggregate([
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        avgBookingValue: { $avg: '$totalAmount' },
        pendingBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        confirmedBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
        },
        cancelledBookings: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
      },
    },
    {
      $addFields: {
        avgBookingValue: { $round: ['$avgBookingValue', 2] },
        totalRevenue: { $round: ['$totalRevenue', 2] },
      },
    },
  ]);

  // Monthly stats
  const monthlyStats = await Booking.aggregate([
    {
      $group: {
        _id: {
          $month: '$createdAt',
        },
        count: { $sum: 1 },
        revenue: { $sum: '$totalAmount' },
      },
    },
    {
      $addFields: {
        month: '$_id',
        revenue: { $round: ['$revenue', 2] },
      },
    },
    {
      $sort: { month: 1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: stats[0] || {},
      monthlyStats,
    },
  });
});

// Check booking expiry (cron job function)
exports.checkExpiredBookings = catchAsync(async (req, res, next) => {
  const expiredBookings = await Booking.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: new Date() },
    },
    {
      status: 'expired',
      paymentStatus: 'failed',
    },
  );

  res.status(200).json({
    status: 'success',
    message: `Marked ${expiredBookings.modifiedCount} bookings as expired`,
  });
});
