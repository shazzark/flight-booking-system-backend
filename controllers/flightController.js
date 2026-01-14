// controllers/flightController.js
const Flight = require('../models/flightModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utilis/catchAsync');
const AppError = require('../utilis/appError');
const APIFeatures = require('../utilis/apiFeatures');

// GET all flights (with search/filter)
// Updated flightController.js - JUST CHANGE THIS ONE FUNCTION
exports.getAllFlights = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Flight.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const flights = await features.query;

  res.status(200).json({
    status: 'success',
    results: flights.length,
    data: {
      flights,
    },
  });
  // res.status(200).json(flights);
});

// GET single flight
exports.getFlight = catchAsync(async (req, res, next) => {
  const flight = await Flight.findById(req.params.id);

  if (!flight) {
    return next(new AppError('No flight found with that ID', 404));
  }

  // res.status(200).json({
  //   status: 'success',
  //   data: {
  //     flight,
  //   },
  // });
  res.status(200).json(flight);
});

// POST create flight (Admin only)
exports.createFlight = catchAsync(async (req, res, next) => {
  const newFlight = await Flight.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      flight: newFlight,
    },
  });
});

// PATCH update flight (Admin only)
exports.updateFlight = catchAsync(async (req, res, next) => {
  const flight = await Flight.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!flight) {
    return next(new AppError('No flight found with that ID', 404));
  }

  // res.status(200).json({
  //   status: 'success',
  //   data: {
  //     flight,
  //   },
  // });
  res.status(200).json(flight);
});

// DELETE flight (Admin only) - Only if no bookings exist
exports.deleteFlight = catchAsync(async (req, res, next) => {
  // Check if flight has bookings
  const bookingsCount = await Booking.countDocuments({
    flight: req.params.id,
    status: { $in: ['pending', 'confirmed'] },
  });

  if (bookingsCount > 0) {
    return next(
      new AppError(
        'Cannot delete flight with active bookings. Cancel flight instead.',
        400,
      ),
    );
  }

  const flight = await Flight.findByIdAndDelete(req.params.id);

  if (!flight) {
    return next(new AppError('No flight found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Search flights with specific criteria
exports.searchFlights = catchAsync(async (req, res, next) => {
  const { origin, destination, departureDate, passengers = 1 } = req.query;

  if (!origin || !destination || !departureDate) {
    return next(
      new AppError(
        'Please provide origin, destination, and departure date',
        400,
      ),
    );
  }

  // Parse departure date range (whole day)
  const startDate = new Date(departureDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(departureDate);
  endDate.setHours(23, 59, 59, 999);

  const flights = await Flight.find({
    origin: origin.toUpperCase(),
    destination: destination.toUpperCase(),
    departureTime: {
      $gte: startDate,
      $lte: endDate,
    },
    seatsAvailable: { $gte: passengers },
    status: 'scheduled',
  }).sort('departureTime');

  // res.status(200).json({
  //   status: 'success',
  //   results: flights.length,
  //   data: {
  //     flights,
  //   },
  // });
  res.status(200).json({
    status: 'success',
    results: flights.length,
    data: { flights },
  });
});

// Cancel flight (Admin only)
exports.cancelFlight = catchAsync(async (req, res, next) => {
  const flight = await Flight.findByIdAndUpdate(
    req.params.id,
    { status: 'cancelled' },
    { new: true },
  );

  if (!flight) {
    return next(new AppError('No flight found with that ID', 404));
  }

  // Update all bookings for this flight to cancelled
  await Booking.updateMany(
    { flight: req.params.id, status: { $in: ['pending', 'confirmed'] } },
    {
      status: 'cancelled',
      paymentStatus: 'refunded',
    },
  );

  res.status(200).json({
    status: 'success',
    data: {
      flight,
    },
  });
});

// Get flight statistics (Admin only)
exports.getFlightStats = catchAsync(async (req, res, next) => {
  const stats = await Flight.aggregate([
    {
      $group: {
        _id: null,
        totalFlights: { $sum: 1 },
        totalSeats: { $sum: '$seatsAvailable' },
        avgPrice: { $avg: '$basePrice' },
        minPrice: { $min: '$basePrice' },
        maxPrice: { $max: '$basePrice' },
      },
    },
    {
      $addFields: {
        avgPrice: { $round: ['$avgPrice', 2] },
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: stats[0] || {},
    },
  });
});
