# SkyBook — Flight Booking Demo (Backend)

SkyBook is a portfolio project that demonstrates a full-stack flight-booking workflow. This repository contains its Express API and Socket.IO server; the companion frontend is a Next.js application. Flights are demo data, not live airline inventory. The current checkout simulates payment and does not charge a card.

The application demonstrates JWT authentication, flight search, bookings, simulated payment and confirmation, user booking history, admin flight management, admin booking and payment views, and live flight-status updates.

## Stack

- **Frontend:** Next.js 15.1.11, React 19, Socket.IO Client 4, Tailwind CSS 4, Framer Motion, Lucide React, and React Context.
- **Backend:** Node.js, Express 5, Socket.IO 4, Mongoose 9, and MongoDB.
- **Other backend dependencies:** `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `cors`, `helmet`, `express-rate-limit`, and `nodemailer`. The package still contains Paystack-related code; it is not used by the demo checkout.

## Architecture

```text
Next.js → REST API service → Express routes/middleware/controllers
                                   ↓
                                Mongoose → MongoDB

Admin flight PATCH → MongoDB save → booking cancellations if needed
                   → flight.updated → Socket.IO flight:<flightId> room
                   → connected viewer → REST flight refetch → updated UI
```

MongoDB and the REST API are authoritative. Socket.IO only notifies connected viewers that a flight changed; it does not store updates or replace REST responses. Express and Socket.IO share one HTTP server and the same `PORT`.

## Live Flight Status

An administrator updates a flight through `PATCH /api/v1/flights/:id` or `PATCH /api/v1/flights/:id/cancel`. The controller saves the flight and completes any required active-booking cancellation before sending `flight.updated` to that flight's room. The event payload contains only `id`, `status`, and `updatedAt`.

The browser sends a flight ID with `flight:subscribe` and `flight:unsubscribe`. The server validates the ID and constructs `flight:<flightId>`; clients cannot choose arbitrary room names. Public flight rooms do not require socket authentication. A viewer of `/booking/[flightId]` refetches the flight through REST when a matching event arrives. After reconnecting, the client resubscribes and refetches to catch missed changes.

Current demo statuses are **Scheduled**, **Boarding**, **Delayed**, **Departed**, **Arrived**, and **Cancelled** (stored in lowercase). Older `completed` records remain valid and the frontend labels them **Arrived**. The dedicated flight search returns scheduled flights only.

## Demo Payment

The frontend's **Simulate Payment** action calls `POST /api/v1/payments/initiate` and then `POST /api/v1/payments/dummy-verify`. The backend records a demo payment and confirms the booking without contacting a payment provider or collecting card number, expiry, or CVV.

Legacy Paystack verification and refund handlers still exist in the backend, along with their dependency and environment variable names. They are not part of the current user-facing demo checkout. Do not treat this application as a real payment service.

## Main API Routes

All routes below use the `/api/v1` prefix.

| Area | Routes |
| --- | --- |
| Authentication | `POST /users/signup`, `POST /users/login`, `POST /users/logout`, `GET /users/me` |
| Public flights | `GET /flights`, `GET /flights/search`, `GET /flights/:id` |
| Admin flights | `POST /flights`, `PATCH /flights/:id`, `PATCH /flights/:id/cancel`, `DELETE /flights/:id` |
| User bookings | `POST /bookings`, `GET /bookings/my-bookings`, `GET /bookings/:id`, `PATCH /bookings/:id/cancel` |
| Admin bookings | `GET /bookings`, `GET /bookings/stats/booking-stats` |
| Demo payment | `POST /payments/initiate`, `POST /payments/dummy-verify` |
| Payment views | `GET /payments/my-payments`, `GET /payments/:id`, admin `GET /payments` |

Admin routes use `protect` followed by `restrictTo('admin')`. The backend accepts a JWT from the `Authorization: Bearer` header or its HTTP-only cookie. The frontend stores the returned bearer token for protected REST requests.

## Local Development

Install dependencies in this backend repository with `npm install`. Configure the ignored `config.env` with your own values for `NODE_ENV`, `PORT`, `DATABASE`, `DATABASE_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `JWT_COOKIE_EXPIRES_IN`. The configured MongoDB Atlas cluster must be available. Email features also use `EMAIL_FROM`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, and `EMAIL_PASSWORD`. `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, and `PAYSTACK_BASE_URL` belong to the legacy Paystack handlers, not the demo checkout. Never commit actual values.

From the backend directory:

```powershell
node server.js
```

With `PORT=5000`, REST is at `http://localhost:5000/api/v1` and Socket.IO is at `http://localhost:5000/socket.io/`. Wait for the database connection message before testing database-backed routes. The current `npm start` script uses `nodemon`; `node server.js` is the direct start command.

In the companion frontend repository, use `NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1` and run `npm run dev` for `http://localhost:3000`. The socket client derives the backend origin (`http://localhost:5000`) from that REST URL.

## Project Structure

```text
server.js             HTTP server, MongoDB connection, Socket.IO startup
app.js                Express middleware and route registration
corsOrigins.js        Origins shared by Express and Socket.IO
flightRooms.js        Flight room validation and subscriptions
routes/               Express API routes
controllers/          Request handling, including flight updates and demo payment
models/               Mongoose User, Flight, Booking, and Payment models
utilis/               Shared API/error/email helpers (existing directory name)
tests/                Backend Node test files
```

## Tests

From the backend directory:

```powershell
node --test tests/demoPayment.test.js tests/flightRooms.test.js tests/flightStatus.test.js
node --check server.js
```

These tests cover the demo payment flow, flight room subscriptions, admin authorization, flight status updates, event routing, and failure ordering. They use mocked database writes; run a browser test against MongoDB Atlas to verify the complete flow.

## Two-Browser Realtime Demo

Use separate browser profiles for a normal user and an administrator. In the user profile, search for a **Scheduled** demo flight and open `/booking/<flightId>`; the page should show **Live**. In Admin Flights, change that same flight from **Scheduled** to **Delayed**. The user's status changes to **Delayed** without a page refresh. Taking the user browser offline, changing the status again, and reconnecting demonstrates resubscription and the REST refetch.

## Deployment

The current deployment layout is **Vercel frontend → Render backend → MongoDB Atlas**. The frontend's production `NEXT_PUBLIC_API_URL` targets the Render REST API. Socket.IO connects to the same Render service's origin and uses its existing HTTP port. Deploy the frontend and backend changes together for the realtime demo; local, uncommitted changes are not available on Render or Vercel.
