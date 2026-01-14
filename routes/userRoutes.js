// routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public authentication routes
router.post('/signup', authController.signup); // POST /api/v1/users/signup
router.post('/login', authController.login); // POST /api/v1/users/login
router.post('/logout', authController.logout); // POST /api/v1/users/logout
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// Protected routes (require login)
router.use(authController.protect); // All routes below require authentication

router.get('/me', userController.getMe); // GET /api/v1/users/me
router.patch('/updateMe', userController.updateMe); // PATCH /api/v1/users/updateMe
router.delete('/deleteMe', userController.deleteMe); // DELETE /api/v1/users/deleteMe
router.patch('/updateMyPassword', authController.updatePassword); // PATCH /api/v1/users/updateMyPassword
router.get('/my-bookings', userController.getMyBookings); // GET /api/v1/users/my-bookings
router.get('/dashboard-stats', userController.getDashboardStats); // GET /api/v1/users/dashboard-stats

// Admin only routes
router.use(authController.restrictTo('admin'));

router.get('/', userController.getAllUsers); // GET /api/v1/users (admin only)
router
  .route('/:id')
  .get(userController.getUser) // GET /api/v1/users/:id
  .patch(userController.updateUser) // PATCH /api/v1/users/:id
  .delete(userController.deleteUser); // DELETE /api/v1/users/:id

module.exports = router;
