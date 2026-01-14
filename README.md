# Flight Booking System - Backend

A production-grade REST API for flight booking system with authentication, flight management, booking, and payment processing.

## Features

- ✅ User authentication & authorization (JWT cookies)
- ✅ Flight CRUD operations with search/filter
- ✅ Booking management with status tracking
- ✅ PayStack payment integration
- ✅ Role-based access control (User/Admin)
- ✅ MongoDB database with Mongoose
- ✅ Security middleware (CORS, rate limiting, sanitization)

## Tech Stack

- **Runtime**: Node.js + Express.js
- **Database**: MongoDB + Mongoose ODM
- **Authentication**: JWT with HTTP-only cookies
- **Payment**: PayStack API integration
- **Security**: Helmet, CORS, rate limiting, data sanitization

## API Endpoints

### Authentication

- `POST /api/v1/users/signup` - Register new user
- `POST /api/v1/users/login` - Login user
- `POST /api/v1/users/logout` - Logout user
- `GET /api/v1/users/me` - Get current user

### Flights (Public)

- `GET /api/v1/flights` - Get all flights (with filters)
- `GET /api/v1/flights/search` - Search flights
- `GET /api/v1/flights/:id` - Get single flight

### Flights (Admin Only)

- `POST /api/v1/flights` - Create flight
- `PATCH /api/v1/flights/:id` - Update flight
- `DELETE /api/v1/flights/:id` - Delete flight
- `PATCH /api/v1/flights/:id/cancel` - Cancel flight

### Bookings (Authenticated)

- `GET /api/v1/bookings/my-bookings` - Get user's bookings
- `POST /api/v1/bookings` - Create booking
- `GET /api/v1/bookings/:id` - Get booking details
- `PATCH /api/v1/bookings/:id/cancel` - Cancel booking

### Bookings (Admin Only)

- `GET /api/v1/bookings` - Get all bookings
- `GET /api/v1/bookings/stats/booking-stats` - Booking statistics

### Payments

- `POST /api/v1/payments/initiate` - Initialize payment (PayStack)
- `GET /api/v1/payments/verify` - Verify payment
- `GET /api/v1/payments/my-payments` - Get user's payments

## Installation

1. **Clone repository**

```bash
git clone <repository-url>
cd backend
```
