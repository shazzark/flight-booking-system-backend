// controllers/userController.js
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utilis/catchAsync');
const AppError = require('../utilis/appError');
const APIFeatures = require('../utilis/apiFeatures');

// Get all users (Admin only)
// controllers/userController.js - Update getAllUsers function
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(User.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const users = await features.query.select(
    '-password -passwordResetToken -passwordResetExpires',
  );

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users,
    },
  });
});

// Get single user (Admin only)
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select(
    '-password -passwordResetToken -passwordResetExpires',
  );

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

// Get current user profile
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select(
    '-password -passwordResetToken -passwordResetExpires',
  );

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

// Update current user profile
exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400,
      ),
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = {};
  if (req.body.name) filteredBody.name = req.body.name;
  if (req.body.email) filteredBody.email = req.body.email;

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  }).select('-password -passwordResetToken -passwordResetExpires');

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

// Delete current user (soft delete)
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Update user (Admin only - including role)
exports.updateUser = catchAsync(async (req, res, next) => {
  // Prevent password updates through this route
  if (req.body.password) {
    return next(new AppError('This route is not for password updates.', 400));
  }

  const filteredBody = {};
  if (req.body.name) filteredBody.name = req.body.name;
  if (req.body.email) filteredBody.email = req.body.email;
  if (req.body.role) filteredBody.role = req.body.role;
  if (req.body.isVerified !== undefined)
    filteredBody.isVerified = req.body.isVerified;

  const user = await User.findByIdAndUpdate(req.params.id, filteredBody, {
    new: true,
    runValidators: true,
  }).select('-password -passwordResetToken -passwordResetExpires');

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

// Delete user (Admin only - hard delete)
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// Get user's bookings
exports.getMyBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id })
    .populate('flight')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: bookings.length,
    data: {
      bookings,
    },
  });
});

// Get user dashboard stats
exports.getDashboardStats = catchAsync(async (req, res, next) => {
  const [totalBookings, confirmedBookings, pendingBookings, cancelledBookings] =
    await Promise.all([
      Booking.countDocuments({ user: req.user.id }),
      Booking.countDocuments({ user: req.user.id, status: 'confirmed' }),
      Booking.countDocuments({ user: req.user.id, status: 'pending' }),
      Booking.countDocuments({ user: req.user.id, status: 'cancelled' }),
    ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        totalBookings,
        confirmedBookings,
        pendingBookings,
        cancelledBookings,
      },
    },
  });
});
