// routes/paymentRoutes.js
const express = require('express');
const paymentController = require('../controllers/paymentController');
const authController = require('../controllers/authController');

const router = express.Router();

// Update your payment routes to include dummy verification
router.post('/dummy-verify', paymentController.verifyDummyPayment);
// router.post('/webhook/paystack', paymentController.paystackWebhook);

// All routes require authentication
router.use(authController.protect);

// USER ROUTES (static paths first)
router.post('/initiate', paymentController.initializePayment);
router.get('/my-payments', paymentController.getMyPayments);
router.get('/verify', paymentController.verifyPayment);

// DYNAMIC PATHS LAST
router.get('/:id', paymentController.getPayment);

// ADMIN ONLY ROUTES
router.use(authController.restrictTo('admin'));
router.get('/stats/payment-stats', paymentController.getPaymentStats);
router.get('/', paymentController.getAllPayments);
router.post('/refund', paymentController.refundPayment);

module.exports = router;
