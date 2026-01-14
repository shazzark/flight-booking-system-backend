// routes/flightRoutes.js
const express = require('express');
const flightController = require('../controllers/flightController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes
router.get('/', flightController.getAllFlights); // GET /api/v1/flights
router.get('/search', flightController.searchFlights); // GET /api/v1/flights/search
router.get('/:id', flightController.getFlight); // GET /api/v1/flights/:id

// Protected routes (Admin only)
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

router.post('/', flightController.createFlight); // POST /api/v1/flights
router.patch('/:id', flightController.updateFlight); // PATCH /api/v1/flights/:id
router.delete('/:id', flightController.deleteFlight); // DELETE /api/v1/flights/:id
router.patch('/:id/cancel', flightController.cancelFlight); // PATCH /api/v1/flights/:id/cancel
router.get('/stats/flight-stats', flightController.getFlightStats); // GET /api/v1/flights/stats/flight-stats

module.exports = router;
