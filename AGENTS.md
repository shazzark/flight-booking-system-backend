# AGENTS.md — SkyBook backend

These instructions apply to this backend repository. The frontend is a separate Next.js repository in the same workspace when both are checked out. Inspect the relevant files and current Git diff before editing; preserve existing work.

## Architecture and scope

- Preserve the current flow: **Next.js → frontend API service → Express routes → auth middleware → controllers → Mongoose models → MongoDB**. Do not reorganize the repositories or introduce a new service/event architecture without a concrete reason and explicit request.
- This is a portfolio/demo application. Flights are demo data and the current checkout is simulated. Do not replace them with airline APIs, real payment processing, or production airline infrastructure unless explicitly requested.
- Keep REST contracts working. Where a response-shape difference only affects frontend consumers, prefer the existing `frontend/app/_lib/apiService.js` normalization pattern over a broad backend contract change.

## Authentication and sensitive data

- `controllers/authController.js` signs JWTs. Login returns a token in JSON and sets an HTTP-only cookie. `protect` accepts `Authorization: Bearer <token>` first, then the cookie, verifies the JWT, loads the user, and checks password-change time. Admin flight routes use `protect` and `restrictTo('admin')`.
- The frontend `AuthProvider` stores the returned token in local storage; its API service sends that bearer token on protected REST requests and uses credentials for cookies. Logout removes the local token and calls the backend logout route.
- Never log JWTs, Authorization headers, cookies, passwords, database credentials, or other secrets. Do not write real environment values into documentation, tests, or commits.

## Flight statuses and realtime rules

- Canonical flight status values in `models/flightModel.js` are `scheduled`, `boarding`, `delayed`, `departed`, `arrived`, and `cancelled`. The model still accepts legacy `completed`; the frontend labels it **Arrived**. Preserve that compatibility unless deliberately migrated.
- `server.js` attaches Socket.IO to the same HTTP server and `PORT` as Express. It stores `io` on the Express app; flight controllers access it through `req.app.get('io')`.
- `flightRooms.js` validates a 24-character hex flight ID and constructs `flight:<flightId>`. Public clients send only the ID via `flight:subscribe` and `flight:unsubscribe`; do not accept arbitrary room names. Public flight rooms currently have no socket authentication.
- Both admin paths, `PATCH /api/v1/flights/:id` and `PATCH /api/v1/flights/:id/cancel`, send `flight.updated` only to that flight's room. Its payload is `{ id, status, updatedAt }`.
- **Order is mandatory:** authenticate and authorize → write and await `flight.save()` → await required active-booking cancellations → emit `flight.updated` → send the normal REST response. A failed save or cancellation must not emit a successful update.
- MongoDB/REST is authoritative. Socket.IO is a transient notification channel, never durable storage. Reconnecting clients must resubscribe and refetch the flight through REST; an empty room means an event is simply missed.

## Payment boundary

- The current browser flow uses `POST /api/v1/payments/initiate` followed by `POST /api/v1/payments/dummy-verify` and confirms a demo booking. Do not introduce card collection or real charges as an incidental cleanup.
- Legacy Paystack verify/refund handlers and package references remain. Do not describe them as the current checkout or expand them without an explicit request.

## Environment and deployment

- Local backend configuration is loaded from the ignored `config.env`; use `PORT`, `DATABASE`, `DATABASE_PASSWORD`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `JWT_COOKIE_EXPIRES_IN` with private values. Do not print or commit those values.
- Local frontend REST can target `http://localhost:5000/api/v1`; Socket.IO targets the backend **origin** (`http://localhost:5000`), not `/api/v1`. Production is Vercel frontend → Render backend → MongoDB Atlas. Socket.IO uses the Render HTTP port, not a second port.
- Allowed frontend origins are shared by Express and Socket.IO in `corsOrigins.js`. Keep them consistent when an origin changes.

## Working and verification rules

- Make focused changes in the existing routes/controllers/models and shared helpers. Avoid duplicate logic and unnecessary abstractions. Inspect both REST and Socket.IO consequences of flight updates.
- Run backend tests with `node --test tests/demoPayment.test.js tests/flightRooms.test.js tests/flightStatus.test.js`. Run `node --check` on changed JavaScript files and `git diff --check`.
- When frontend behavior changes, run its existing test and `npm run build`; its standalone `npm run lint` currently lacks an installed ESLint executable.
- Report every file changed, checks run, and material limits. Do not commit or deploy unless explicitly requested.
