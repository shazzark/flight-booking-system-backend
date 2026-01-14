// controllers/paymentController.js
const Paystack = require('paystack-api');
const Payment = require('../models/paymentModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utilis/catchAsync');
const AppError = require('../utilis/appError');

const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY);

// Initialize payment
// exports.initializePayment = catchAsync(async (req, res, next) => {
//   const { bookingId, email, amount, currency = 'NGN' } = req.body;

//   // 1) Get booking
//   const booking = await Booking.findById(bookingId);
//   if (!booking) {
//     return next(new AppError('Booking not found', 404));
//   }

//   // 2) Check if booking belongs to user
//   if (booking.user.toString() !== req.user.id) {
//     return next(
//       new AppError('You are not authorized to pay for this booking', 403),
//     );
//   }

//   // 3) Check booking status
//   if (booking.status !== 'pending') {
//     return next(new AppError(`Booking is already ${booking.status}`, 400));
//   }

//   // 4) Check if payment already exists
//   const existingPayment = await Payment.findOne({ booking: bookingId });
//   if (existingPayment && existingPayment.status === 'success') {
//     return next(
//       new AppError('Payment already completed for this booking', 400),
//     );
//   }

//   // 5) Generate unique reference
//   const reference =
//     `FLT${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

//   // 6) Initialize PayStack payment
//   const paystackResponse = await paystack.transaction.initialize({
//     email: email || req.user.email,
//     amount: amount * 100, // Convert to kobo
//     currency: currency,
//     reference: reference,
//     callback_url: `${process.env.FRONTEND_URL}/booking/confirm/${bookingId}`,
//     metadata: {
//       bookingId: bookingId.toString(),
//       userId: req.user.id.toString(),
//       custom_fields: [
//         {
//           display_name: 'Booking Reference',
//           variable_name: 'booking_reference',
//           value: booking.bookingReference,
//         },
//       ],
//     },
//   });

//   // 7) Create payment record
//   const payment = await Payment.create({
//     user: req.user.id,
//     booking: bookingId,
//     amount: amount,
//     currency: currency,
//     reference: reference,
//     metadata: {
//       bookingReference: booking.bookingReference,
//       flightDetails: booking.flight.toString(),
//     },
//   });

//   res.status(200).json({
//     status: 'success',
//     data: {
//       authorization_url: paystackResponse.data.authorization_url,
//       access_code: paystackResponse.data.access_code,
//       reference: paystackResponse.data.reference,
//       payment,
//     },
//   });
// });

// Verify payment callback
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { reference } = req.query;

  if (!reference) {
    return next(new AppError('Payment reference is required', 400));
  }

  // 1) Verify with PayStack
  const verification = await paystack.transaction.verify({
    reference: reference,
  });

  // 2) Find payment record
  const payment = await Payment.findOne({ reference: reference })
    .populate('booking')
    .populate('user');

  if (!payment) {
    return next(new AppError('Payment record not found', 404));
  }

  // 3) Update payment status based on PayStack response
  if (verification.data.status === 'success') {
    payment.status = 'success';
    payment.transactionId = verification.data.id;
    payment.completedAt = new Date();
    payment.metadata.paystackResponse = verification.data;

    // Update booking
    if (payment.booking) {
      payment.booking.status = 'confirmed';
      payment.booking.paymentStatus = 'paid';
      await payment.booking.save();
    }
  } else {
    payment.status = 'failed';
    payment.metadata.paystackResponse = verification.data;

    if (payment.booking) {
      payment.booking.status = 'expired';
      payment.booking.paymentStatus = 'failed';
      await payment.booking.save();
    }
  }

  await payment.save();

  res.status(200).json({
    status: 'success',
    data: {
      payment,
      verification: verification.data,
    },
  });
});

// Get all payments (Admin only)
exports.getAllPayments = catchAsync(async (req, res, next) => {
  const payments = await Payment.find()
    .populate('user', 'name email')
    .populate('booking')
    .sort('-initiatedAt');

  // res.status(200).json({
  //   status: 'success',
  //   results: payments.length,
  //   data: {
  //     payments,
  //   },
  // });
  res.status(200).json(payments);
});

// Get user's payments
exports.getMyPayments = catchAsync(async (req, res, next) => {
  const payments = await Payment.find({ user: req.user.id })
    .populate('booking')
    .sort('-initiatedAt');

  // res.status(200).json({
  //   status: 'success',
  //   results: payments.length,
  //   data: {
  //     payments,
  //   },
  // });
  res.status(200).json(payments); // <- payments is already an array
});

// Get payment by ID
exports.getPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.id)
    .populate('user', 'name email')
    .populate('booking');

  if (!payment) {
    return next(new AppError('No payment found with that ID', 404));
  }

  // Check if user owns the payment or is admin
  if (
    payment.user._id.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new AppError('You are not authorized to view this payment', 403),
    );
  }

  // res.status(200).json({
  //   status: 'success',
  //   data: {
  //     payment,
  //   },
  // });
  res.status(200).json(payment);
});

// Refund payment (Admin only)
exports.refundPayment = catchAsync(async (req, res, next) => {
  const { paymentId, reason } = req.body;

  const payment = await Payment.findById(paymentId);

  if (!payment) {
    return next(new AppError('Payment not found', 404));
  }

  if (payment.status !== 'success') {
    return next(new AppError('Only successful payments can be refunded', 400));
  }

  // Initiate PayStack refund
  const refund = await paystack.refund.create({
    transaction: payment.transactionId,
    amount: payment.amount * 100,
    currency: payment.currency,
    reason: reason || 'Customer request',
  });

  // Update payment status
  payment.status = 'refunded';
  payment.metadata.refund = refund.data;
  await payment.save();

  // Update booking
  if (payment.booking) {
    const booking = await Booking.findById(payment.booking);
    booking.status = 'cancelled';
    booking.paymentStatus = 'refunded';
    await booking.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      payment,
      refund: refund.data,
    },
  });
});

// Get payment statistics (Admin only)
exports.getPaymentStats = catchAsync(async (req, res, next) => {
  const stats = await Payment.aggregate([
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalRevenue: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, '$amount', 0] },
        },
        successfulPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] },
        },
        failedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
        },
        refundedPayments: {
          $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] },
        },
      },
    },
    {
      $addFields: {
        totalRevenue: { $round: ['$totalRevenue', 2] },
        successRate: {
          $round: [
            {
              $multiply: [
                { $divide: ['$successfulPayments', '$totalPayments'] },
                100,
              ],
            },
            2,
          ],
        },
      },
    },
  ]);

  // Daily revenue
  const dailyRevenue = await Payment.aggregate([
    {
      $match: {
        status: 'success',
        completedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
        revenue: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $addFields: {
        date: '$_id',
        revenue: { $round: ['$revenue', 2] },
      },
    },
    {
      $sort: { date: 1 },
    },
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: stats[0] || {},
      dailyRevenue,
    },
  });
});

exports.initializePayment = catchAsync(async (req, res, next) => {
  const { bookingId, email, amount, currency = 'NGN' } = req.body;

  // 1) Get booking
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return next(new AppError('Booking not found', 404));
  }

  // 2) Check if booking belongs to user
  if (booking.user.toString() !== req.user.id) {
    return next(
      new AppError('You are not authorized to pay for this booking', 403),
    );
  }

  // 3) Check booking status
  if (booking.status !== 'pending') {
    return next(new AppError(`Booking is already ${booking.status}`, 400));
  }

  // 4) Check if payment already exists
  const existingPayment = await Payment.findOne({ booking: bookingId });
  if (existingPayment && existingPayment.status === 'success') {
    return next(
      new AppError('Payment already completed for this booking', 400),
    );
  }

  // 5) Generate unique reference
  const reference =
    `FLT${Date.now()}${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

  // 6) Create payment record
  const payment = await Payment.create({
    user: req.user.id,
    booking: bookingId,
    amount: amount,
    currency: currency,
    reference: reference,
    metadata: {
      bookingReference: booking.bookingReference,
      flightDetails: booking.flight.toString(),
    },
  });

  // 7) Return dummy response
  const dummyResponse = {
    authorization_url: `${process.env.FRONTEND_URL}/booking/confirm/${bookingId}?reference=${reference}`,
    access_code: 'dummy_access_code',
    reference: reference,
  };

  res.status(200).json({
    status: 'success',
    data: {
      ...dummyResponse,
      payment,
    },
  });
});

// Add this verification endpoint for dummy payment
exports.verifyDummyPayment = catchAsync(async (req, res, next) => {
  const { reference, bookingId } = req.query;

  if (!reference || !bookingId) {
    return next(new AppError('Reference and booking ID are required', 400));
  }

  // Find payment
  const payment = await Payment.findOne({ reference: reference })
    .populate('booking')
    .populate('user');

  if (!payment) {
    return next(new AppError('Payment record not found', 404));
  }

  // Simulate successful payment
  payment.status = 'success';
  payment.transactionId = `DUMMY_TXN_${Date.now()}`;
  payment.completedAt = new Date();
  await payment.save();

  // Update booking
  if (payment.booking) {
    payment.booking.status = 'confirmed';
    payment.booking.paymentStatus = 'paid';
    await payment.booking.save();
  }

  res.status(200).json({
    status: 'success',
    data: {
      payment,
      message: 'Payment verified successfully (Dummy payment)',
    },
  });
});
