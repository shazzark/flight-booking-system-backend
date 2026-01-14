// routes/bookingRoutes.js
const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');

const router = express.Router();

// All routes require authentication
router.use(authController.protect);

// User routes
router.get('/my-bookings', bookingController.getMyBookings); // GET /api/v1/bookings/my-bookings
router.post('/', bookingController.createBooking); // POST /api/v1/bookings
router.get('/:id', bookingController.getBooking); // GET /api/v1/bookings/:id
router.patch('/:id/cancel', bookingController.cancelBooking); // PATCH /api/v1/bookings/:id/cancel

// Admin only routes
router.use(authController.restrictTo('admin'));
router.get('/', bookingController.getAllBookings); // GET /api/v1/bookings (admin only)
router.get('/stats/booking-stats', bookingController.getBookingStats); // GET /api/v1/bookings/stats/booking-stats
router.post('/check-expired', bookingController.checkExpiredBookings); // POST /api/v1/bookings/check-expired

module.exports = router;
